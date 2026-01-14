import inert from '@hapi/inert'

import { home } from './home/index.js'
import { about } from './about/index.js'
import { health } from './health/index.js'
// import { upload } from './upload/index.js' // Removed - upload now handled via AJAX on homepage
import review from './review/index.js'
import { uploadApiController } from './api/upload.js'
import { textReviewApiController } from './api/text-review.js'
import { getReviewsController } from './api/reviews.js'
import { serveStaticFiles } from './common/helpers/serve-static-files.js'

export const router = {
  plugin: {
    name: 'router',
    async register(server) {
      await server.register([inert])

      // Health-check route. Used by platform to check if service is running, do not remove!
      await server.register([health])

      // API routes
      server.route({
        method: 'POST',
        path: '/api/upload',
        handler: async (request, h) => {
          return uploadApiController.uploadFile(request, h)
        },
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
        handler: getReviewsController
      })

      server.route({
        method: 'POST',
        path: '/api/review-text',
        handler: async (request, h) => {
          return textReviewApiController.reviewText(request, h)
        },
        options: {
          payload: {
            parse: true,
            allow: 'application/json'
          }
        }
      })

      // Application specific routes, add your own routes here
      await server.register([home, about, review]) // upload removed - now via AJAX API

      // Static assets
      await server.register([serveStaticFiles])
    }
  }
}
