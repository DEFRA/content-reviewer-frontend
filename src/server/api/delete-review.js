import fetch from 'node-fetch'
import { config } from '../../config/config.js'
import { createLogger } from '../common/helpers/logging/logger.js'

const logger = createLogger()
const backendUrl = config.get('backendUrl')

/**
 * Delete a review from the backend
 * @param {import('@hapi/hapi').Request} request
 * @param {import('@hapi/hapi').ResponseToolkit} h
 * @returns {Promise<import('@hapi/hapi').ResponseObject>}
 */
export async function deleteReviewController(request, h) {
  const startTime = Date.now()
  const requestLogger = request.logger
  const reviewId = request.params.reviewId

  try {
    const backendRequestStart = Date.now()
    const endpoint = `${backendUrl}/api/reviews/${reviewId}`
    logger.info(`Deleting review via backend: ${endpoint}`)

    // Forward delete request to backend
    const response = await fetch(endpoint, {
      method: 'DELETE',
      headers: {
        Accept: 'application/json'
      }
    })

    const backendRequestEnd = Date.now()
    const backendRequestTime = (backendRequestEnd - backendRequestStart) / 1000

    if (!response.ok) {
      const errorText = await response.text()
      let errorData
      try {
        errorData = JSON.parse(errorText)
      } catch {
        errorData = { error: errorText }
      }

      logger.error(
        `Backend delete request failed - endpoint: ${endpoint}, status: ${response.status}, error: ${errorData.error || errorText}, requestTime: ${backendRequestTime}s`
      )

      requestLogger.error(
        { status: response.status, reviewId },
        'Failed to delete review from backend'
      )

      return h
        .response({
          success: false,
          error: errorData.error || 'Failed to delete review',
          message:
            errorData.message || `Backend returned status ${response.status}`
        })
        .code(response.status)
    }

    const data = await response.json()

    logger.info(
      `Review deleted successfully - reviewId: ${reviewId}, requestTime: ${backendRequestTime}s`
    )

    return h
      .response({
        success: true,
        message: data.message || 'Review deleted successfully',
        reviewId
      })
      .code(200)
  } catch (error) {
    const totalProcessingTime = (Date.now() - startTime) / 1000

    logger.error('Delete review API request failed with error', {
      error: error.message,
      stack: error.stack,
      reviewId,
      totalProcessingTime: `${totalProcessingTime}s`
    })

    requestLogger.error(
      { error: error.message, reviewId },
      'Error deleting review'
    )

    return h
      .response({
        success: false,
        error: 'Internal server error',
        message: error.message
      })
      .code(500)
  }
}

/**
 * Route configuration for delete review
 */
export const deleteReviewRoute = {
  method: 'DELETE',
  path: '/api/reviews/{reviewId}',
  handler: deleteReviewController,
  options: {
    description: 'Delete a review and its associated S3 content',
    tags: ['api', 'reviews', 'delete']
  }
}
