import { reviewHistoryController } from './controller.js'

export default {
  plugin: {
    name: 'review-history',
    register: async (server) => {
      server.route([
        {
          method: 'GET',
          path: '/review/history',
          handler: reviewHistoryController.showHistory
        },
        {
          method: 'POST',
          path: '/review/history/{reviewId}/delete',
          handler: reviewHistoryController.deleteReview
        }
      ])
    }
  }
}
