import { privacyController } from './controller.js'

/**
 * Sets up the routes used in the /privacy page.
 * These routes are registered in src/server/router.js.
 */
export const privacy = {
  plugin: {
    name: 'privacy',
    register (server) {
      server.route([
        {
          method: 'GET',
          path: '/privacy',
          ...privacyController
        }
      ])
    }
  }
}
