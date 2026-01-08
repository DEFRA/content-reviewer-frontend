import { debugController } from './controller.js'

export default {
  plugin: {
    name: 'review-debug',
    register: async (server) => {
      server.route([
        {
          method: 'GET',
          path: '/review/debug/{id}',
          ...debugController
        }
      ])
    }
  }
}
