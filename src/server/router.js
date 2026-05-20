import inert from '@hapi/inert'

import { config } from '../config/config.js'
import { home } from './home/index.js'
import { about } from './about/index.js'
import { health } from './health/index.js'
import { upload } from './upload/index.js'
import review from './review/index.js'
import { cookies } from './cookies/index.js'
import { privacy } from './privacy/index.js'
import { accessibility } from './accessibility/index.js'
import { contact } from './contact/index.js'
import { textReviewApiController } from './api/text-review.js'
import { getReviewsController } from './api/reviews.js'
import { deleteReviewRoute } from './api/delete-review.js'
import { fetchUrlController } from './api/fetch-url.js'
import { urlReviewController } from './api/url-review.js'
import { fileReviewHandler } from './api/file-review.js'
import { serveStaticFiles } from './common/helpers/serve-static-files.js'
import { loginController } from './auth/login/controller.js'

/**
 * Register all API routes on the server.
 * Extracted to keep the main register function within SonarQube line limits.
 */
function registerApiRoutes(server) {
  server.route({
    method: 'GET',
    path: '/api/reviews',
    handler: getReviewsController,
    options: {
      cache: {
        // Tell Hapi not to cache on the server side - reviews are dynamic
        // but allow short-lived browser caching with revalidation
        otherwise: 'no-cache, no-store, must-revalidate'
      }
    }
  })

  server.route(deleteReviewRoute)

  server.route({
    method: 'POST',
    path: '/api/review/text',
    handler: async (request, h) =>
      textReviewApiController.reviewText(request, h),
    options: { payload: { parse: true, allow: 'application/json' } }
  })

  server.route({
    method: 'POST',
    path: '/api/review/url',
    handler: urlReviewController.handler,
    options: {
      payload: { parse: true, allow: 'application/json' },
      // Longer per-route socket timeout because this handler chains a GOV.UK
      // fetch + content extraction + backend submission in one request.
      // Sourced from `routes.socketTimeoutLongMs` (ROUTE_SOCKET_TIMEOUT_LONG_MS).
      timeout: { socket: config.get('routes.socketTimeoutLongMs') }
    }
  })

  server.route({
    method: 'POST',
    path: '/api/review/file',
    handler: fileReviewHandler,
    options: {
      payload: {
        output: 'stream',
        parse: true,
        allow: 'multipart/form-data',
        maxBytes: config.get('cdpUploader.maxFileSize')
      }
    }
  })

  server.route({
    method: 'GET',
    path: '/api/fetch-url',
    handler: fetchUrlController.handler,
    options: {
      auth: false,
      // Per-route socket timeout for the GOV.UK proxy. Matches fetch.timeoutMs
      // so the socket does not outlive the in-handler AbortController.
      // Sourced from `routes.socketTimeoutFetchMs` (ROUTE_SOCKET_TIMEOUT_FETCH_MS).
      timeout: { socket: config.get('routes.socketTimeoutFetchMs') }
    }
  })
}

export const router = {
  plugin: {
    name: 'router',
    async register(server) {
      await server.register([inert])

      // Health-check route. Used by platform to check if service is running, do not remove!
      await server.register([health])

      // Unprotected login landing page (shows Login UI before SSO redirect)
      server.route({
        method: 'GET',
        path: '/auth/login-page',
        options: { auth: false },
        ...loginController
      })

      // API routes
      registerApiRoutes(server)

      // Application specific routes, add your own routes here
      await server.register([
        home,
        about,
        upload,
        review,
        cookies,
        privacy,
        accessibility,
        contact
      ])

      // Static assets
      await server.register([serveStaticFiles])
    }
  }
}
