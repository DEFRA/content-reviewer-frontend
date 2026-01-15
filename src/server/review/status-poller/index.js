import { reviewStatusPollerController } from './controller.js'

export default {
  plugin: {
    name: 'review-status-poller',
    register: async (server) => {
      server.route([
        {
          method: 'GET',
          path: '/review/status-poller/{reviewId}',
          handler: reviewStatusPollerController.showStatusPoller
        },
        {
          method: 'GET',
          path: '/review/status/{reviewId}',
          handler: reviewStatusPollerController.getReviewStatus
        }
      ])
    }
  }
}
