import { contentReviewController } from './controller.js'

const contentReview = {
  plugin: {
    name: 'content-review',
    register: async (server, options) => {
      server.route([
        {
          method: 'GET',
          path: '/',
          ...contentReviewController
        },
        {
          method: 'GET',
          path: '/content-review',
          ...contentReviewController
        }
      ])
    }
  }
}

export { contentReview }
