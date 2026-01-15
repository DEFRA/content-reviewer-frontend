import fetch from 'node-fetch'
import { config } from '../../config/config.js'

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
  const logger = request.logger

  try {
    logger.info('Fetching review history from backend')

    // Fetch review history from backend
    const response = await fetch(
      `${backendUrl}/api/review-history?userId=all&limit=50`,
      {
        method: 'GET',
        headers: {
          Accept: 'application/json'
        }
      }
    )

    if (!response.ok) {
      logger.error(
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
    logger.info(
      { count: data.reviews ? data.reviews.length : 0 },
      'Review history fetched successfully'
    )

    return h
      .response({
        success: true,
        reviews: data.reviews || [],
        count: data.reviews ? data.reviews.length : 0
      })
      .code(200)
  } catch (error) {
    logger.error({ error: error.message }, 'Error fetching review history')
    return h
      .response({
        success: false,
        message: error.message,
        reviews: []
      })
      .code(500)
  }
}
