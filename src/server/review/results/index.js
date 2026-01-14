import { resultsController } from './controller.js'

export default {
  plugin: {
    name: 'review-results',
    register: async (server) => {
      server.route([
        {
          method: 'GET',
          path: '/review/results/{id}',
          ...resultsController
        }
      ])
    }
  }
}
