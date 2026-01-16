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
    console.log(
      '[REVIEW-HISTORY-CONTROLLER] Processing review history page request'
    )

    try {
      const config = request.server.app.config
      const backendUrl = config.get('backendUrl')

      logger.info('Configuration retrieved for review history', { backendUrl })
      console.log('[REVIEW-HISTORY-CONTROLLER] Backend URL:', backendUrl)

      // Fetch review history from backend (S3-backed storage)
      const backendRequestStart = Date.now()
      logger.info('Initiating review history fetch', {
        endpoint: `${backendUrl}/api/reviews?limit=100`
      })
      console.log(
        '[REVIEW-HISTORY-CONTROLLER] Fetching review history from backend'
      )
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
      console.log(
        '[REVIEW-HISTORY-CONTROLLER] Review history fetch response:',
        {
          status: response.status,
          statusText: response.statusText,
          ok: response.ok
        }
      )

      if (!response.ok) {
        logger.error('Review history fetch failed', {
          status: response.status,
          statusText: response.statusText,
          requestTime: `${backendRequestTime}s`
        })
        console.error(
          '[REVIEW-HISTORY-CONTROLLER] Failed to fetch review history:',
          response.status
        )
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
      console.log('[REVIEW-HISTORY-CONTROLLER] Review history data received:', {
        reviewsCount: data.reviews?.length || 0,
        total: data.total || data.count || 0
      })

      const viewData = {
        pageTitle: 'Review History',
        heading: 'Review History',
        reviews: data.reviews || [],
        count: data.total || data.count || 0
      }

      logger.info('Rendering review history view')
      console.log('[REVIEW-HISTORY-CONTROLLER] Rendering review history view')
      return h.view('review/history/index', viewData)
    } catch (error) {
      const totalProcessingTime = (Date.now() - startTime) / 1000

      logger.error('Review history request failed with error', {
        error: error.message,
        stack: error.stack,
        totalProcessingTime: `${totalProcessingTime}s`
      })
      console.error(
        '[REVIEW-HISTORY-CONTROLLER] Error processing review history request:',
        {
          message: error.message,
          stack: error.stack
        }
      )

      request.logger.error(error, 'Failed to fetch review history')

      const errorViewData = {
        pageTitle: 'Review History',
        heading: 'Review History',
        reviews: [],
        count: 0,
        error: 'Unable to load review history. Please try again later.'
      }

      logger.info('Rendering error view for review history')
      console.log(
        '[REVIEW-HISTORY-CONTROLLER] Rendering error view for review history'
      )
      return h.view('review/history/index', errorViewData)
    }
  },

  /**
   * Delete a review from history
   */
  async deleteReview(request, h) {
    const startTime = Date.now()
    logger.info('Delete review request started')
    console.log('[REVIEW-HISTORY-CONTROLLER] Processing delete review request')

    try {
      const { reviewId } = request.params
      const config = request.server.app.config
      const backendUrl = config.get('backendUrl')

      logger.info('Delete review request details', {
        reviewId,
        backendUrl
      })
      console.log('[REVIEW-HISTORY-CONTROLLER] Delete review request:', {
        reviewId,
        backendUrl
      })

      const backendRequestStart = Date.now()
      logger.info('Initiating delete request to backend', {
        reviewId,
        endpoint: `${backendUrl}/api/review-history/${reviewId}`
      })
      console.log(
        '[REVIEW-HISTORY-CONTROLLER] Making delete request to backend'
      )
      const response = await fetch(
        `${backendUrl}/api/review-history/${reviewId}`,
        {
          method: 'DELETE'
        }
      )

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
      console.log('[REVIEW-HISTORY-CONTROLLER] Delete response:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok
      })

      if (!response.ok) {
        logger.error('Delete request failed', {
          reviewId,
          status: response.status,
          statusText: response.statusText,
          requestTime: `${backendRequestTime}s`
        })
        console.error(
          '[REVIEW-HISTORY-CONTROLLER] Delete request failed:',
          response.status
        )
        throw new Error('Failed to delete review')
      }

      logger.info('Review deleted successfully, redirecting', {
        reviewId,
        totalProcessingTime: `${totalProcessingTime}s`
      })
      console.log(
        '[REVIEW-HISTORY-CONTROLLER] Review deleted successfully, redirecting to history'
      )
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
