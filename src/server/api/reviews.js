import { config } from '../../config/config.js'
import { createLogger } from '../common/helpers/logging/logger.js'
import { getUserIdentifier } from '../common/helpers/get-user-identifier.js'
import { Agent } from 'undici'

const logger = createLogger()
const backendUrl = config.get('backendUrl')
const PAGE_SIZE = 25
const INTERNAL_SERVER_ERROR = 500
const OK = 200

// Reuse a single undici Agent with keep-alive across all /api/reviews fetch calls.
// Node 18+ built-in fetch uses undici internally, so passing an undici Agent
// as the `dispatcher` option is the correct way to enable connection reuse.
// This avoids a new TCP handshake on every auto-refresh poll (every 5 seconds),
// significantly reducing latency for the most frequent API call in the app.
const keepAliveAgent = new Agent({
  keepAliveTimeout: 30_000, // keep idle connections open for 30 s
  keepAliveMaxTimeout: 300_000, // maximum keep-alive window
  connections: 10 // max concurrent connections to backend
})

/**
 * Calculate pagination parameters
 * @param {Object} query - Query parameters
 * @returns {Object} Pagination parameters
 */
function calculatePagination(query) {
  const page = Number.parseInt(query.page) || 1
  const limit = Number.parseInt(query.limit) || PAGE_SIZE
  // When limit exceeds PAGE_SIZE, paginate in PAGE_SIZE chunks so each page
  // returns exactly PAGE_SIZE records (matching what the SSR home controller does).
  const effectivePageSize = Math.min(limit, PAGE_SIZE)
  const skip = (page - 1) * effectivePageSize
  return { limit, page, skip }
}

/**
 * Normalize reviews data
 * @param {Array} reviews - Reviews array
 * @returns {Array} Normalized reviews
 */
function normalizeReviews(reviews) {
  return Array.isArray(reviews) ? reviews : []
}

/**
 * Create error response
 * @param {import('@hapi/hapi').ResponseToolkit} h - Response toolkit
 * @param {string} message - Error message
 * @param {number} _limit - Limit parameter
 * @param {number} _skip - Skip parameter
 * @returns {import('@hapi/hapi').ResponseObject}
 */
function createErrorResponse(h, message, _limit, _skip) {
  return h
    .response({
      success: false,
      reviews: [],
      count: 0,
      total: 0,
      error: message
    })
    .code(INTERNAL_SERVER_ERROR)
}

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
 * Fetch reviews from backend, scoped to the authenticated user.
 * @param {number} limit - Limit parameter
 * @param {number} skip - Skip parameter
 * @param {number} _page - Page number
 * @param {string|null} userId - Authenticated user ID for per-user filtering
 * @returns {Promise<Object>}
 */
async function fetchReviewsFromBackend(limit, skip, _page, userId = null) {
  const params = new URLSearchParams({ limit, skip })
  if (userId) {
    params.set('userId', userId)
  }
  const endpoint = `${backendUrl}/api/reviews?${params.toString()}`
  const startTime = Date.now()
  const response = await fetch(endpoint, {
    // Pass the undici Agent as dispatcher so the built-in fetch reuses TCP connections
    dispatcher: keepAliveAgent
  })
  const backendRequestTime = ((Date.now() - startTime) / 1000).toFixed(2)
  return { response, backendRequestTime, endpoint }
}

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
  const { limit, page, skip } = calculatePagination(request.query)
  // For authenticated users, scope results to their own reviews.
  // For anonymous users, userId is null and no filter is applied — all reviews are returned.
  const userId = getUserIdentifier(request)

  try {
    const { response, backendRequestTime, endpoint } =
      await fetchReviewsFromBackend(limit, skip, page, userId)

    if (!response.ok) {
      logger.error(
        `Backend review history request failed - endpoint: ${endpoint}, status: ${response.status}, statusText: ${response.statusText}, requestTime: ${backendRequestTime}s`
      )
      requestLogger.error(
        { status: response.status },
        'Failed to fetch review history from backend'
      )
      return createErrorResponse(
        h,
        'Failed to fetch review history',
        limit,
        skip
      )
    }

    const data = await response.json()
    const normalizedReviews = normalizeReviews(data.reviews)

    return h
      .response({
        success: true,
        reviews: normalizedReviews,
        count: normalizedReviews.length,
        total: data.pagination?.total || normalizedReviews.length,
        pagination: data.pagination || {
          total: normalizedReviews.length,
          limit,
          skip,
          returned: normalizedReviews.length
        }
      })
      .code(OK)
  } catch (error) {
    const totalProcessingTime = (Date.now() - startTime) / 1000

    logger.error('Review history API request failed with error', {
      error: error.message,
      stack: error.stack,
      totalProcessingTime: `${totalProcessingTime}s`,
      endpoint: `${backendUrl}/api/reviews?limit=${limit}&skip=${skip}`
    })

    requestLogger.error(
      { error: error.message },
      'Error fetching review history'
    )
    return createErrorResponse(h, error.message, limit, skip)
  }
}
