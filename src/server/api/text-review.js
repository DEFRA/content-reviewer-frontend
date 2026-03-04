import fetch from 'node-fetch'
import { config } from '../../config/config.js'
import { createLogger } from '../common/helpers/logging/logger.js'
import { getUserIdentifier } from '../common/helpers/get-user-identifier.js'

const logger = createLogger()

const HTTP_STATUS = {
  OK: 200,
  BAD_REQUEST: 400,
  INTERNAL_SERVER_ERROR: 500
}

const TITLE_MAX_LENGTH = 50
const TITLE_WORD_COUNT = 3

/**
 * Validate text content
 */
function validateTextContent(textContent, h) {
  if (!textContent || textContent.trim().length < 10) {
    return h
      .response({
        success: false,
        message: 'Text content too short. Enter at least 10 characters'
      })
      .code(HTTP_STATUS.BAD_REQUEST)
  }
  return null
}

/**
 * Generate title from text content
 */
function generateTitle(textContent, title) {
  if (title) {
    return title
  }
  const words = textContent
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0)
  return words.length > 0
    ? words
        .slice(0, TITLE_WORD_COUNT)
        .join(' ')
        .substring(0, TITLE_MAX_LENGTH) + '...'
    : 'Text Content'
}

/**
 * Submit to backend
 * Passes the authenticated user's ID as x-user-id header so the backend
 * can store it on the review record for per-user filtering.
 */
async function submitToBackend(textContent, finalTitle, request) {
  const backendUrl = config.get('backendUrl')
  logger.info(
    `Requesting text review from backend: ${backendUrl}/api/review/text`
  )

  // Prefer the SSO-authenticated user ID from the session cookie over any
  // client-supplied header, so it cannot be spoofed.
  // For anonymous users, use session ID for consistent tracking.
  const userId = getUserIdentifier(request)

  logger.info(`[TEXT-REVIEW] Submitting with userId: ${userId}`)

  const backendRequestStart = Date.now()

  const response = await fetch(`${backendUrl}/api/review/text`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(userId ? { 'x-user-id': userId } : {})
    },
    body: JSON.stringify({
      content: textContent,
      title: finalTitle
    })
  })

  const backendRequestEnd = Date.now()
  const backendRequestTime = (backendRequestEnd - backendRequestStart) / 1000

  return { response, backendRequestTime }
}

/**
 * Handle text content submission for review
 */
async function reviewText(request, h) {
  const startTime = Date.now()

  try {
    const { textContent, title } = request.payload

    // Validate text content
    const validationError = validateTextContent(textContent, h)
    if (validationError) {
      return validationError
    }

    const finalTitle = generateTitle(textContent, title)

    const textInfo = {
      length: textContent.length,
      lengthKB: (textContent.length / 1024).toFixed(2),
      wordCount: textContent
        .trim()
        .split(/\s+/)
        .filter((word) => word.length > 0).length
    }

    const { response, backendRequestTime } = await submitToBackend(
      textContent,
      finalTitle,
      request
    )

    if (!response.ok) {
      logger.error('Backend text review request failed', {
        status: response.status,
        statusText: response.statusText,
        backendRequestTime
      })
      return h
        .response({
          success: false,
          message: 'Failed to submit text content to backend'
        })
        .code(HTTP_STATUS.INTERNAL_SERVER_ERROR)
    }

    const result = await response.json()

    const totalProcessingTime = (Date.now() - startTime) / 1000

    logger.info('Text review request successful', {
      reviewId: result.reviewId,
      textLength: textInfo.length,
      wordCount: textInfo.wordCount,
      backendRequestTime,
      totalProcessingTime
    })

    return h
      .response({
        success: true,
        message: 'Text content submitted successfully',
        reviewId: result.reviewId
      })
      .code(HTTP_STATUS.OK)
  } catch (error) {
    const totalProcessingTime = (Date.now() - startTime) / 1000

    logger.error(
      `Text review API request failed with error - error: ${error.message}, totalProcessingTime: ${totalProcessingTime}s`
    )

    return h
      .response({
        success: false,
        message: error.message || 'Internal server error'
      })
      .code(HTTP_STATUS.INTERNAL_SERVER_ERROR)
  }
}

export const textReviewApiController = {
  reviewText
}
