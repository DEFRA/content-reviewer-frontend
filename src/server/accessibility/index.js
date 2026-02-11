import { accessibilityController } from './controller.js'

/**
 * Sets up the routes used in the /accessibility page.
 * These routes are registered in src/server/router.js.
 */
export const accessibility = {
  plugin: {
    name: 'accessibility',
    register(server) {
      server.route([
        {
          method: 'GET',
          path: '/accessibility',
          ...accessibilityController
        }
      ])
    }
  }
}
