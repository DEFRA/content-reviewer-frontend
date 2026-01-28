import fetch from 'node-fetch'
import { config } from '../../config/config.js'
import { createLogger } from '../common/helpers/logging/logger.js'

const logger = createLogger()
const backendUrl = config.get('backendUrl')

/**
 * @typedef {Object} ReviewItem
 * @property {string} uploadId
 * @property {string} filename
 * @property {string} status
 * @property {string} method
 * @property {string} uploadedAt
 * @property {string} timestamp
 */

/**
 * Get review history from backend
 * @param {import('@hapi/hapi').Request} request
 * @param {import('@hapi/hapi').ResponseToolkit} h
 * @returns {Promise<import('@hapi/hapi').ResponseObject>}
 */
export async function getReviewsController(request, h) {
  const startTime = Date.now()
  const requestLogger = request.logger

  // Get limit from query parameter, default to 10
  const limit = request.query.limit || 10

  logger.info('Review history API request started', {
    userAgent: request.headers['user-agent'],
    clientIP: request.info.remoteAddress,
    backendUrl,
    limit
  })

  try {
    logger.info('Fetching review history from backend', { limit })
    requestLogger.info('Fetching review history from backend', { limit })

    const backendRequestStart = Date.now()
    const endpoint = `${backendUrl}/api/reviews?limit=${limit}`

    logger.info('Initiating backend request for review history', {
      endpoint,
      method: 'GET',
      limit
    })

    // Fetch review history from backend
    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        Accept: 'application/json'
      }
    })

    const backendRequestEnd = Date.now()
    const backendRequestTime = (backendRequestEnd - backendRequestStart) / 1000

    logger.info('Backend review history request completed', {
      endpoint,
      responseStatus: response.status,
      responseStatusText: response.statusText,
      requestTime: `${backendRequestTime}s`,
      success: response.ok
    })

    if (!response.ok) {
      logger.error('Backend review history request failed', {
        endpoint,
        status: response.status,
        statusText: response.statusText,
        requestTime: `${backendRequestTime}s`
      })

      requestLogger.error(
        { status: response.status },
        'Failed to fetch review history from backend'
      )
      return h
        .response({
          success: false,
          message: 'Failed to fetch review history',
          reviews: []
        })
        .code(500)
    }

    const data = await response.json()
    const totalProcessingTime = (Date.now() - startTime) / 1000

    logger.info('Review history fetched and parsed successfully', {
      reviewsCount: data.reviews ? data.reviews.length : 0,
      totalCount: data.total || data.count || 0,
      totalProcessingTime: `${totalProcessingTime}s`,
      backendRequestTime: `${backendRequestTime}s`
    })

    requestLogger.info(
      { count: data.reviews ? data.reviews.length : 0 },
      'Review history fetched successfully'
    )

    // Normalize review items to always include an `id` field
    const normalizedReviews = (data.reviews || []).map((r) => ({
      ...r,
      id: r.id || r.reviewId // ensure id is present for frontend links
    }))

    return h
      .response({
        success: true,
        reviews: normalizedReviews,
        count: normalizedReviews.length
      })
      .code(200)
  } catch (error) {
    const totalProcessingTime = (Date.now() - startTime) / 1000

    logger.error('Review history API request failed with error', {
      error: error.message,
      stack: error.stack,
      totalProcessingTime: `${totalProcessingTime}s`,
      endpoint: `${backendUrl}/api/reviews?limit=${limit}`
    })

    requestLogger.error(
      { error: error.message },
      'Error fetching review history'
    )
    return h
      .response({
        success: false,
        message: error.message,
        reviews: []
      })
      .code(500)
  }
}
