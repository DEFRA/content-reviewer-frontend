import { cookiesGetController, cookiesPostController } from './controller.js'

/**
 * Sets up the routes used in the /cookies page.
 * These routes are registered in src/server/router.js.
 */
export const cookies = {
  plugin: {
    name: 'cookies',
    register (server) {
      server.route([
        {
          method: 'GET',
          path: '/cookies',
          ...cookiesGetController
        },
        {
          method: 'POST',
          path: '/cookies',
          ...cookiesPostController
        }
      ])
    }
  }
}
