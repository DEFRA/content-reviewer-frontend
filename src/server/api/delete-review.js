import { Agent } from 'undici'
import { config } from '../../config/config.js'
import { createLogger } from '../common/helpers/logging/logger.js'

const HTTP_STATUS_OK = 200
const HTTP_STATUS_INTERNAL_SERVER_ERROR = 500

// Hard limit on frontend → backend calls. Must be well below the Hapi socket timeout (90 s).
const BACKEND_TIMEOUT_MS = 30_000

const logger = createLogger()
const backendUrl = config.get('backendUrl')

// Reuse a single undici Agent with keep-alive for all delete review backend calls
const keepAliveAgent = new Agent({
  keepAliveTimeout: 30_000,
  keepAliveMaxTimeout: 300_000,
  connections: 5
})

/**
 * Execute the DELETE request against the backend, enforcing BACKEND_TIMEOUT_MS
 * via an AbortController. The AbortError propagates to the caller's catch block.
 * @param {string} endpoint - full backend URL to DELETE
 * @returns {Promise<Response>}
 */
async function fetchDelete(endpoint) {
  const controller = new AbortController()
  /* v8 ignore next -- timer callback fires only in production when the backend is unresponsive */
  const timer = setTimeout(() => controller.abort(), BACKEND_TIMEOUT_MS)
  try {
    return await fetch(endpoint, {
      method: 'DELETE',
      headers: { Accept: 'application/json' },
      dispatcher: keepAliveAgent,
      signal: controller.signal
    })
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Build an error response when the backend returns a non-2xx status.
 * Attempts JSON parsing for structured error details; falls back to raw text.
 * @param {Response} response
 * @param {string} endpoint
 * @param {string} reviewId
 * @param {number} backendRequestTime - elapsed seconds for the backend request
 * @param {object} requestLogger - Hapi request logger
 * @param {object} h - Hapi response toolkit
 */
async function handleDeleteBackendError(
  response,
  endpoint,
  reviewId,
  backendRequestTime,
  requestLogger,
  h
) {
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
      message: errorData.message || `Backend returned status ${response.status}`
    })
    .code(response.status)
}

/**
 * Build an error response for unexpected errors caught during the delete flow.
 * AbortError is treated as a timeout; all other errors become generic 500 responses.
 * @param {Error} error
 * @param {string} reviewId
 * @param {object} requestLogger - Hapi request logger
 * @param {number} startTime - Date.now() at request start
 * @param {object} h - Hapi response toolkit
 */
function handleDeleteError(error, reviewId, requestLogger, startTime, h) {
  const totalProcessingTime = (Date.now() - startTime) / 1000

  if (error.name === 'AbortError') {
    logger.error(
      `Delete review backend request timed out after ${BACKEND_TIMEOUT_MS / 1000}s — reviewId: ${reviewId}, totalProcessingTime: ${totalProcessingTime}s`
    )
    return h
      .response({
        success: false,
        error: 'Request timed out',
        message: 'The delete request timed out. Please try again.'
      })
      .code(HTTP_STATUS_INTERNAL_SERVER_ERROR)
  }

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
    .code(HTTP_STATUS_INTERNAL_SERVER_ERROR)
}

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

    // fetchDelete enforces BACKEND_TIMEOUT_MS — prevents a hanging delete.
    const response = await fetchDelete(endpoint)
    const backendRequestTime = (Date.now() - backendRequestStart) / 1000

    if (!response.ok) {
      return await handleDeleteBackendError(
        response,
        endpoint,
        reviewId,
        backendRequestTime,
        requestLogger,
        h
      )
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
      .code(HTTP_STATUS_OK)
  } catch (error) {
    return handleDeleteError(error, reviewId, requestLogger, startTime, h)
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
