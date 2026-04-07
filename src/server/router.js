import inert from '@hapi/inert'

import { home } from './home/index.js'
import { about } from './about/index.js'
import { health } from './health/index.js'
// import { upload } from './upload/index.js' // Removed - upload now handled via AJAX on homepage
import review from './review/index.js'
import { cookies } from './cookies/index.js'
import { privacy } from './privacy/index.js'
import { accessibility } from './accessibility/index.js'
import { contact } from './contact/index.js'
import { uploadApiController } from './api/upload.js'
import { textReviewApiController } from './api/text-review.js'
import { getReviewsController } from './api/reviews.js'
import { deleteReviewRoute } from './api/delete-review.js'
import { fetchUrlController } from './api/fetch-url.js'
import { urlReviewController } from './api/url-review.js'
import { serveStaticFiles } from './common/helpers/serve-static-files.js'
import { loginController } from './auth/login/controller.js'

/**
 * Register all API routes on the server.
 * Extracted to keep the main register function within SonarQube line limits.
 */
function registerApiRoutes(server) {
  server.route({
    method: 'POST',
    path: '/api/upload',
    handler: async (request, h) => uploadApiController.uploadFile(request, h),
    options: {
      payload: {
        output: 'stream',
        parse: true,
        multipart: true,
        maxBytes: 10 * 1024 * 1024, // 10MB
        allow: 'multipart/form-data'
      }
    }
  })

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
      timeout: { socket: 60_000 } // Allow up to 60s for fetch + extraction + backend
    }
  })

  server.route({
    method: 'GET',
    path: '/api/fetch-url',
    handler: fetchUrlController.handler,
    options: {
      auth: false,
      timeout: { socket: 30_000 } // Allow up to 30s for gov.uk pages to respond
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
        review,
        cookies,
        privacy,
        accessibility,
        contact
      ]) // upload removed - now via AJAX API

      // Static assets
      await server.register([serveStaticFiles])
    }
  }
}
