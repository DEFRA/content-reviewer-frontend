import { Agent } from 'undici'

const HTTP_STATUS_OK = 200
const HTTP_STATUS_INTERNAL_SERVER_ERROR = 500

// Reuse a single undici Agent with keep-alive for all status polling backend calls
const keepAliveAgent = new Agent({
  keepAliveTimeout: 30_000,
  keepAliveMaxTimeout: 300_000,
  connections: 5
})

/**
 * Review Status Poller Controller
 * Handles polling for AI review progress and completion
 */

export const reviewStatusPollerController = {
  /**
   * Show review status polling page
   */
  async showStatusPoller(request, h) {
    const { reviewId } = request.params

    if (!reviewId) {
      return h.redirect('/upload')
    }

    return h.view('review/status-poller/index', {
      pageTitle: 'AI Review in Progress',
      heading: 'AI Content Review in Progress',
      reviewId
    })
  },

  /**
   * API endpoint to get review status
   */
  async getReviewStatus(request, h) {
    try {
      const { reviewId } = request.params
      const config = request.server.app.config
      const backendUrl = config.get('backendUrl')

      // Fetch status from backend
      const response = await fetch(`${backendUrl}/api/results/${reviewId}`, {
        dispatcher: keepAliveAgent
      })

      if (!response.ok) {
        throw new Error('Failed to fetch review status')
      }

      const statusData = await response.json()
      return h.response(statusData).code(HTTP_STATUS_OK)
    } catch (error) {
      request.logger.error(error, 'Failed to get review status')
      return h
        .response({
          error: 'Failed to get review status',
          status: 'error'
        })
        .code(HTTP_STATUS_INTERNAL_SERVER_ERROR)
    }
  }
}
