import path from 'node:path'
import crypto from 'node:crypto'
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

/**
 * Configure the session cookie authentication strategy on the server.
 *
 * Cookie behaviour:
 *  - TTL: 10 hours (GDS standard – one working day).  keepAlive resets the
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
      ttl: sessionConfig.cookie.ttl, // 10 hours – sets Max-Age so cookie persists after browser close
      isHttpOnly: true, // Not accessible via JavaScript
      encoding: 'iron' // Encrypted + signed payload
    },
    redirectTo: false, // Don't redirect to login - auth is optional
    keepAlive: true, // Resets TTL on every authenticated request
    validate: async (_request, session) => {
      console.log(
        '[COOKIE-VALIDATE] Validating session:',
        JSON.stringify(session, null, 2)
      )

      if (!session) {
        console.log('[COOKIE-VALIDATE] No session found - returning invalid')
        return { isValid: false }
      }
      // Accept both authenticated sessions AND anonymous sessions
      // Authenticated session: has isAuthenticated = true and user object
      if (session.isAuthenticated === true && session.user) {
        console.log('[COOKIE-VALIDATE] Authenticated session valid')
        return { isValid: true, credentials: session }
      }
      // Anonymous session: has a session ID (sid) for tracking
      if (session.sid) {
        return { isValid: true, credentials: session }
      }
      return { isValid: false }
    }
  })

  // Apply session auth as the default strategy for all routes
  // Mode set to 'optional' to allow access without login (for users not in Defra tenant)
  server.auth.default({ strategy: 'session', mode: 'optional' })
}

/**
 * Register an onPreResponse extension that injects the authenticated user
 * into every Nunjucks view context so templates can access {{ user }}.
 */
function injectUserContext(server) {
  server.ext('onPreResponse', (request, h) => {
    const response = request.response
    if (
      response &&
      typeof response.variety === 'string' &&
      response.variety === 'view'
    ) {
      const user = request.auth?.credentials?.user ?? null
      response.source.context = response.source.context || {}
      response.source.context.user = user
    }
    return h.continue
  })
}

/**
 * Initialize a session for anonymous users on their first request.
 * This ensures getUserIdentifier can track reviews per-session for non-authenticated users.
 */
function initializeAnonymousSessions(server) {
  server.ext('onPostAuth', (request, h) => {
    // Only create session for anonymous users (not authenticated)
    const isAuthenticated = request.auth?.credentials?.isAuthenticated === true

    if (isAuthenticated) {
      return h.continue
    }

    // Check if anonymous session already exists in credentials
    const hasSessionId = request.auth?.credentials?.sid

    if (!hasSessionId) {
      // Create a new anonymous session with a cryptographically secure unique session ID
      // Use crypto.randomBytes for secure random generation instead of Math.random()
      const randomBytes = crypto.randomBytes(16)
      const randomPart = randomBytes.toString('hex')
      const sessionId = `${Date.now()}-${randomPart}`

      // Set the session cookie with the new session ID
      request.cookieAuth.set({
        sid: sessionId,
        isAuthenticated: false,
        createdAt: new Date().toISOString()
      })

      // Also update auth.credentials so it's immediately available in this request
      request.auth.credentials = {
        sid: sessionId,
        isAuthenticated: false,
        createdAt: new Date().toISOString()
      }
    }

    return h.continue
  })
}

export async function createServer() {
  setupProxy()
  const server = hapi.server({
    host: config.get('host'),
    port: config.get('port'),
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

  server.app.config = config

  await server.register(hapiCookie)
  configureCookieAuth(server)

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

  server.ext('onPreResponse', catchAll)
  injectUserContext(server)
  initializeAnonymousSessions(server)

  return server
}
