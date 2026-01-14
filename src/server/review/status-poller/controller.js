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
      const response = await fetch(`${backendUrl}/api/review/${reviewId}`)

      if (!response.ok) {
        throw new Error('Failed to fetch review status')
      }

      const statusData = await response.json()

      return h.response(statusData).code(200)
    } catch (error) {
      request.logger.error(error, 'Failed to get review status')
      return h
        .response({
          error: 'Failed to get review status',
          status: 'error'
        })
        .code(500)
    }
  }
}
