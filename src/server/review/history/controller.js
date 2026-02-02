/**
 * Review History Controller
 * Handles displaying list of past reviews
 */
import { createLogger } from '../../common/helpers/logging/logger.js'

const logger = createLogger()

export const reviewHistoryController = {
  /**
   * Show review history page
   */
  async showHistory(request, h) {
    const startTime = Date.now()
    logger.info('Review history page request started')

    try {
      const config = request.server.app.config
      const backendUrl = config.get('backendUrl')

      logger.info('Configuration retrieved for review history', { backendUrl })

      // Fetch review history from backend (S3-backed storage)
      const backendRequestStart = Date.now()
      logger.info('Initiating review history fetch', {
        endpoint: `${backendUrl}/api/reviews?limit=100`
      })

      const response = await fetch(`${backendUrl}/api/reviews?limit=100`)

      const backendRequestEnd = Date.now()
      const backendRequestTime =
        (backendRequestEnd - backendRequestStart) / 1000

      logger.info('Review history fetch response received', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
        requestTime: `${backendRequestTime}s`
      })

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

      logger.info('Review history processed successfully', {
        reviewsCount: data.reviews?.length || 0,
        total: data.total || data.count || 0,
        totalProcessingTime: `${totalProcessingTime}s`,
        backendRequestTime: `${backendRequestTime}s`
      })

      const viewData = {
        pageTitle: 'Review History',
        heading: 'Review History',
        reviews: data.reviews || [],
        count: data.total || data.count || 0
      }

      logger.info('Rendering review history view')
      return h.view('review/history/index', viewData)
    } catch (error) {
      const totalProcessingTime = (Date.now() - startTime) / 1000

      logger.error('Review history request failed with error', {
        error: error.message,
        stack: error.stack,
        totalProcessingTime: `${totalProcessingTime}s`
      })

      request.logger.error(error, 'Failed to fetch review history')

      const errorViewData = {
        pageTitle: 'Review History',
        heading: 'Review History',
        reviews: [],
        count: 0,
        error: 'Unable to load review history. Please try again later.'
      }

      logger.info('Rendering error view for review history')
      return h.view('review/history/index', errorViewData)
    }
  },

  /**
   * Delete a review from history
   */
  async deleteReview(request, h) {
    const startTime = Date.now()
    logger.info('Delete review request started')

    try {
      const { reviewId } = request.params
      const config = request.server.app.config
      const backendUrl = config.get('backendUrl')

      logger.info('Delete review request details', {
        reviewId,
        backendUrl
      })

      const backendRequestStart = Date.now()
      logger.info('Initiating delete request to backend', {
        reviewId,
        endpoint: `${backendUrl}/api/results/${reviewId}`
      })

      const response = await fetch(`${backendUrl}/api/results/${reviewId}`, {
        method: 'DELETE'
      })

      const backendRequestEnd = Date.now()
      const backendRequestTime =
        (backendRequestEnd - backendRequestStart) / 1000
      const totalProcessingTime = (Date.now() - startTime) / 1000

      logger.info('Delete request completed', {
        reviewId,
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
        requestTime: `${backendRequestTime}s`,
        totalProcessingTime: `${totalProcessingTime}s`
      })

      if (!response.ok) {
        logger.error('Delete request failed', {
          reviewId,
          status: response.status,
          statusText: response.statusText,
          requestTime: `${backendRequestTime}s`
        })
        throw new Error('Failed to delete review')
      }

      logger.info('Review deleted successfully, redirecting', {
        reviewId,
        totalProcessingTime: `${totalProcessingTime}s`
      })
      // Redirect back to history
      return h.redirect('/review/history')
    } catch (error) {
      const totalProcessingTime = (Date.now() - startTime) / 1000

      logger.error('Delete review request failed with error', {
        reviewId: request.params.reviewId,
        error: error.message,
        stack: error.stack,
        totalProcessingTime: `${totalProcessingTime}s`
      })
      console.error('[REVIEW-HISTORY-CONTROLLER] Error deleting review:', {
        message: error.message,
        stack: error.stack
      })

      request.logger.error(error, 'Failed to delete review')
      logger.info('Redirecting with error parameter after delete failure')
      console.log(
        '[REVIEW-HISTORY-CONTROLLER] Redirecting with error parameter'
      )
      return h.redirect('/review/history?error=delete_failed')
    }
  }
}
