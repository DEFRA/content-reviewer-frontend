/**
 * Review History Controller
 * Handles displaying list of past reviews
 */
import { createLogger } from '../../common/helpers/logging/logger.js'
import { getUserIdentifier } from '../../common/helpers/get-user-identifier.js'
import { Agent } from 'undici'

const logger = createLogger()
const REVIEW_HISTORY_TITLE = 'Review History'

// Reuse a single undici Agent with keep-alive for all history page backend calls
const keepAliveAgent = new Agent({
  keepAliveTimeout: 30_000,
  keepAliveMaxTimeout: 300_000,
  connections: 5
})

export const reviewHistoryController = {
  /**
   * Show review history page
   */
  async showHistory(request, h) {
    const startTime = Date.now()

    try {
      const config = request.server.app.config
      const backendUrl = config.get('backendUrl')

      // Scope results to the authenticated/session user
      const userId = getUserIdentifier(request)
      const params = new URLSearchParams({ limit: 100 })
      if (userId) {
        params.set('userId', userId)
      }
      const endpoint = `${backendUrl}/api/reviews?${params.toString()}`

      const backendRequestStart = Date.now()
      const response = await fetch(endpoint, { dispatcher: keepAliveAgent })
      const backendRequestTime = (Date.now() - backendRequestStart) / 1000

      if (!response.ok) {
        logger.error('Review history fetch failed', {
          status: response.status,
          statusText: response.statusText,
          requestTime: `${backendRequestTime}s`
        })
        throw new Error('Failed to fetch review history')
      }

      const data = await response.json()
      const totalProcessingTime = (Date.now() - startTime) / 1000

      logger.info(
        `Review history processed - count: ${data.reviews?.length ?? 0}, total: ${data.total ?? data.count ?? 0}, time: ${totalProcessingTime}s`
      )

      return h.view('review/history/index', {
        pageTitle: REVIEW_HISTORY_TITLE,
        heading: REVIEW_HISTORY_TITLE,
        breadcrumbs: [
          { text: 'Home', href: '/' },
          { text: REVIEW_HISTORY_TITLE }
        ],
        reviews: data.reviews || [],
        count: data.total || data.count || 0
      })
    } catch (error) {
      const totalProcessingTime = (Date.now() - startTime) / 1000

      logger.error('Review history request failed', {
        error: error.message,
        stack: error.stack,
        totalProcessingTime: `${totalProcessingTime}s`
      })

      request.logger.error(error, 'Failed to fetch review history')

      return h.view('review/history/index', {
        pageTitle: REVIEW_HISTORY_TITLE,
        heading: REVIEW_HISTORY_TITLE,
        breadcrumbs: [
          { text: 'Home', href: '/' },
          { text: REVIEW_HISTORY_TITLE }
        ],
        reviews: [],
        count: 0,
        error: 'Unable to load review history. Please try again later.'
      })
    }
  },

  /**
   * Delete a review from history
   */
  async deleteReview(request, h) {
    const startTime = Date.now()

    try {
      const { reviewId } = request.params
      const config = request.server.app.config
      const backendUrl = config.get('backendUrl')

      const backendRequestStart = Date.now()
      const response = await fetch(`${backendUrl}/api/reviews/${reviewId}`, {
        method: 'DELETE',
        dispatcher: keepAliveAgent
      })
      const backendRequestTime = (Date.now() - backendRequestStart) / 1000
      const totalProcessingTime = (Date.now() - startTime) / 1000

      if (!response.ok) {
        logger.error('Delete request failed', {
          reviewId,
          status: response.status,
          requestTime: `${backendRequestTime}s`
        })
        throw new Error('Failed to delete review')
      }

      logger.info(
        `Review deleted - id: ${reviewId}, time: ${totalProcessingTime}s`
      )
      return h.redirect('/review/history')
    } catch (error) {
      const totalProcessingTime = (Date.now() - startTime) / 1000

      logger.error('Delete review request failed', {
        reviewId: request.params.reviewId,
        error: error.message,
        totalProcessingTime: `${totalProcessingTime}s`
      })

      request.logger.error(error, 'Failed to delete review')
      return h.redirect('/review/history?error=delete_failed')
    }
  }
}
