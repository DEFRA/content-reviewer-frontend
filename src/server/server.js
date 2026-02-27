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
    redirectTo: '/auth/login-page',
    keepAlive: true, // Resets TTL on every authenticated request
    validate: async (_request, session) => {
      if (!session) {
        return { isValid: false }
      }
      if (session.isAuthenticated === true && session.user) {
        return { isValid: true, credentials: session }
      }
      return { isValid: false }
    }
  })

  // Apply session auth as the default strategy for all routes
  server.auth.default({ strategy: 'session', mode: 'required' })
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

  return server
}
