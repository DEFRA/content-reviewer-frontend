import { config } from '../../../config/config.js'
import { statusCodes } from '../constants/status-codes.js'
import path from 'node:path'

export const serveStaticFiles = {
  plugin: {
    name: 'staticFiles',
    register(server) {
      const publicPath = path.join(config.get('root'), '.public')

      server.route([
        {
          options: {
            auth: false,
            cache: {
              expiresIn: config.get('staticCacheTimeout'),
              privacy: 'private'
            }
          },
          method: 'GET',
          path: '/favicon.ico',
          handler(_request, h) {
            return h.response().code(statusCodes.noContent).type('image/x-icon')
          }
        },
        {
          options: {
            auth: false,
            cache: {
              expiresIn: config.get('staticCacheTimeout'),
              privacy: 'private'
            }
          },
          method: 'GET',
          path: `${config.get('assetPath')}/{param*}`,
          handler: {
            directory: {
              path: publicPath,
              redirectToSlash: true
            }
          }
        }
      ])
    }
  }
}
