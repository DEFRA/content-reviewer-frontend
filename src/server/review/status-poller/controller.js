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
    const startTime = performance.now()
    try {
      const { reviewId } = request.params
      const config = request.server.app.config
      const backendUrl = config.get('backendUrl')

      request.logger.info({ reviewId }, '[status-poller] Polling review status')

      // Fetch status from backend
      const fetchStart = performance.now()
      const response = await fetch(
        `${backendUrl}/api/results/${reviewId}/status`,
        {
          dispatcher: keepAliveAgent
        }
      )
      const fetchDuration = Math.round(performance.now() - fetchStart)

      if (!response.ok) {
        throw new Error('Failed to fetch review status')
      }

      const statusData = await response.json()
      const totalDuration = Math.round(performance.now() - startTime)

      request.logger.info(
        {
          reviewId,
          status: statusData.status,
          fetchDurationMs: fetchDuration,
          totalDurationMs: totalDuration
        },
        `[RESPONSE TIME] [status-poller] Review status retrieved in ${totalDuration}ms (status: ${statusData.status})`
      )

      return h.response(statusData).code(HTTP_STATUS_OK)
    } catch (error) {
      const totalDuration = Math.round(performance.now() - startTime)
      request.logger.error(
        { error: error.message, durationMs: totalDuration },
        `Failed to get review status after ${totalDuration}ms`
      )
      return h
        .response({
          error: 'Failed to get review status',
          status: 'error'
        })
        .code(HTTP_STATUS_INTERNAL_SERVER_ERROR)
    }
  }
}
