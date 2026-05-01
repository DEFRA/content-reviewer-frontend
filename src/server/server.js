import path from 'node:path'
import hapi from '@hapi/hapi'
import hapiCookie from '@hapi/cookie'
import Scooter from '@hapi/scooter'

import { router } from './router.js'
import { config } from '../config/config.js'
import { pulse } from './common/helpers/pulse.js'
import { catchAll } from './common/helpers/errors.js'
import { nunjucksConfig } from '../config/nunjucks/nunjucks.js'
import { setupProxy } from './common/helpers/proxy/setup-proxy.js'
import { requestTracing } from './common/helpers/request-tracing.js'
import { requestLogger } from './common/helpers/logging/request-logger.js'
import { sessionCache } from './common/helpers/session-cache/session-cache.js'
import { getCacheEngine } from './common/helpers/session-cache/cache-engine.js'
import { secureContext } from '@defra/hapi-secure-context'
import { contentSecurityPolicy } from './common/helpers/content-security-policy.js'
import { azureAuth } from './plugins/azure-auth.js'

// ── Per-IP rate limiting ──────────────────────────────────────────────────────
// In-memory store: key = IP, value = { count, resetAt }.
// NOTE: In a multi-instance deployment each pod enforces independently;
// a Redis-backed store would give a true global limit, but this still
// protects against single-client bursts hitting one pod.
const HTTP_UNAUTHORISED = 401
const HTTP_TOO_MANY_REQUESTS = 429
const rateLimitStore = new Map()

function getRateLimitEntry(ip, windowMs) {
  const now = Date.now()
  const entry = rateLimitStore.get(ip) ?? {
    count: 0,
    resetAt: now + windowMs
  }
  if (now > entry.resetAt) {
    entry.count = 0
    entry.resetAt = now + windowMs
  }
  return entry
}

/**
 * Configure the session cookie authentication strategy on the server.
 *
 * Cookie behaviour:
 *  - TTL: 1 hour (GOV.UK One Login standard).  keepAlive resets the
 *    clock on every request so active users are never interrupted mid-session.
 *  - Persistent: the cookie carries a Max-Age so it survives a browser close.
 *    If a user closes the browser and returns within the TTL window they are
 *    automatically signed in without being prompted for credentials again.
 *  - Secure: HttpOnly + SameSite=Lax + Secure (production only) + encrypted
 *    payload (iron-sealed by @hapi/cookie using SESSION_COOKIE_PASSWORD).
 */
function configureCookieAuth(server) {
  const sessionConfig = config.get('session')
  const isProductionEnv = config.get('isProduction')

  server.auth.strategy('session', 'cookie', {
    cookie: {
      name: 'content-reviewer-session',
      path: '/',
      password: sessionConfig.cookie.password,
      isSecure: isProductionEnv, // HTTPS-only in production / CDP
      isSameSite: 'Lax', // CSRF protection while allowing OAuth redirects
      ttl: sessionConfig.cookie.ttl, // 1 hour – sets Max-Age; keepAlive resets on every request
      isHttpOnly: true, // Not accessible via JavaScript
      encoding: 'iron' // Encrypted + signed payload
    },
    redirectTo: false, // Redirects handled by setupAuthRedirect onPreResponse
    keepAlive: true, // Resets TTL on every authenticated request
    validate: async (_request, session) => {
      if (!session) {
        return { isValid: false }
      }
      // Only accept authenticated sessions (isAuthenticated = true with a user object)
      if (session.isAuthenticated === true && session.user) {
        return { isValid: true, credentials: session }
      }
      return { isValid: false }
    }
  })

  // Apply session auth as the default strategy for all routes — sign-in is required
  server.auth.default({ strategy: 'session', mode: 'required' })
}

/**
 * Intercept 401 Unauthorized responses and redirect unauthenticated users to
 * the login page, saving the originally requested URL so they can be returned
 * there after a successful login. API requests (AJAX) receive a JSON 401
 * instead so client-side code can handle it without a full page redirect.
 */
function setupAuthRedirect(server) {
  server.ext('onPreResponse', (request, h) => {
    const { response } = request
    if (!response.isBoom || response.output.statusCode !== HTTP_UNAUTHORISED) {
      return h.continue
    }
    if (request.path.startsWith('/api/')) {
      return h
        .response({ error: 'Unauthorised' })
        .code(HTTP_UNAUTHORISED)
        .takeover()
    }
    request.yar.set(
      'returnTo',
      request.url.pathname + (request.url.search || '')
    )
    return h.redirect('/auth/login-page').takeover()
  })
}

/**
 * Register an onPreResponse extension that injects the authenticated user
 * into every Nunjucks view context so templates can access {{ user }}.
 * Non-view responses (JSON, redirects, errors) are skipped immediately.
 */
function injectUserContext(server) {
  server.ext('onPreResponse', (request, h) => {
    const response = request.response
    // Only inject into Nunjucks view responses – skip JSON/redirects/errors
    if (response?.variety !== 'view') {
      return h.continue
    }
    const user = request.auth?.credentials?.user ?? null
    response.source.context = response.source.context || {}
    response.source.context.user = user
    return h.continue
  })
}

function createHapiServer() {
  return hapi.server({
    host: config.get('host'),
    port: config.get('port'),
    compression: { minBytes: 512 }, // Gzip/deflate responses larger than 512 bytes
    routes: {
      validate: { options: { abortEarly: false } },
      files: { relativeTo: path.resolve(config.get('root'), '.public') },
      security: {
        hsts: { maxAge: 31536000, includeSubDomains: true, preload: false },
        xss: 'enabled',
        noSniff: true,
        xframe: true
      }
    },
    router: { stripTrailingSlash: true },
    cache: [
      {
        name: config.get('session.cache.name'),
        engine: getCacheEngine(config.get('session.cache.engine'))
      }
    ],
    state: { strictHeader: false }
  })
}

async function registerPlugins(server) {
  await server.register([
    requestLogger,
    requestTracing,
    secureContext,
    pulse,
    sessionCache,
    nunjucksConfig,
    Scooter, // must be registered before blankie/contentSecurityPolicy
    contentSecurityPolicy,
    azureAuth,
    router
  ])
}

function registerRateLimiting(server) {
  const rateLimitEnabled = config.get('rateLimit.enabled')
  if (!rateLimitEnabled) {
    return
  }
  const rateLimitWindowMs = config.get('rateLimit.windowMs')
  const rateLimitMaxRequests = config.get('rateLimit.maxRequests')
  server.ext('onRequest', (request, h) => {
    if (request.path === '/health') {
      return h.continue
    }
    const ip = request.info.remoteAddress
    const entry = getRateLimitEntry(ip, rateLimitWindowMs)
    entry.count++
    rateLimitStore.set(ip, entry)
    if (entry.count > rateLimitMaxRequests) {
      server.logger.warn(
        { ip, count: entry.count, limit: rateLimitMaxRequests },
        'Rate limit exceeded'
      )
      return h
        .response(
          '<h1>429 Too Many Requests</h1><p>Please try again later.</p>'
        )
        .type('text/html')
        .code(HTTP_TOO_MANY_REQUESTS)
        .takeover()
    }
    return h.continue
  })
}

function registerSecurityHeaders(server) {
  server.ext('onPreResponse', (request, h) => {
    const { response } = request
    const headers = {
      'Referrer-Policy': 'no-referrer',
      'Permissions-Policy': 'geolocation=(), camera=(), microphone=()'
    }
    if (response.isBoom) {
      Object.assign(response.output.headers, headers)
    } else {
      for (const [name, value] of Object.entries(headers)) {
        response.header(name, value)
      }
    }
    return h.continue
  })
}

export async function createServer() {
  setupProxy()
  const server = createHapiServer()
  server.app.config = config

  await server.register(hapiCookie)
  configureCookieAuth(server)

  await registerPlugins(server)
  registerRateLimiting(server)
  setupAuthRedirect(server)
  server.ext('onPreResponse', catchAll)
  registerSecurityHeaders(server)
  injectUserContext(server)

  return server
}
