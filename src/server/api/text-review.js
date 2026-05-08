import { config } from '../../config/config.js'
import { createLogger } from '../common/helpers/logging/logger.js'
import { getUserIdentifier } from '../common/helpers/get-user-identifier.js'
import { Agent } from 'undici'

const logger = createLogger()

// Hard limit on frontend → backend calls. Backend responds quickly (async via SQS)
// so 30 s is more than enough. Must be well below the Hapi socket timeout (90 s).
const BACKEND_TIMEOUT_MS = 30_000

// Reuse a single undici Agent with keep-alive for all text review backend calls
const keepAliveAgent = new Agent({
  keepAliveTimeout: 30_000,
  keepAliveMaxTimeout: 300_000,
  connections: 5
})

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
  // Caller validates textContent has ≥ 10 chars, so split/filter always yields ≥ 1 word.
  return (
    textContent
      .trim()
      .split(/\s+/)
      .filter((word) => word.length > 0)
      .slice(0, TITLE_WORD_COUNT)
      .join(' ')
      .substring(0, TITLE_MAX_LENGTH) + '...'
  )
}

/**
 * Submit to backend
 * Passes the authenticated user's ID as x-user-id so the backend can
 * store it for per-user filtering.
 */
async function submitToBackend(
  textContent,
  finalTitle,
  request,
  sourceType,
  sourceUrl
) {
  const backendUrl = config.get('backendUrl')
  logger.info(
    `Requesting text review from backend: ${backendUrl}/api/review/text`
  )

  // Pass the authenticated user's ID so the backend scopes the review to that user.
  const userId = getUserIdentifier(request)

  const backendRequestStart = Date.now()

  // AbortController enforces BACKEND_TIMEOUT_MS — if the backend does not
  // respond in time the fetch rejects with an AbortError, caught in reviewText.
  const controller = new AbortController()
  /* v8 ignore next -- timer callback fires only in production when the backend is unresponsive */
  const timer = setTimeout(() => controller.abort(), BACKEND_TIMEOUT_MS)

  try {
    const response = await fetch(`${backendUrl}/api/review/text`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(userId ? { 'x-user-id': userId } : {})
      },
      body: JSON.stringify({
        content: textContent,
        title: finalTitle,
        sourceType: sourceType || 'text',
        sourceUrl: sourceUrl || null
      }),
      dispatcher: keepAliveAgent,
      signal: controller.signal
    })

    const backendRequestTime = (Date.now() - backendRequestStart) / 1000
    return { response, backendRequestTime }
  } finally {
    // Always clear the timer — whether fetch succeeded or threw
    clearTimeout(timer)
  }
}

/**
 * Build a plain object of text metrics used for logging and validation.
 */
function getTextInfo(textContent) {
  return {
    length: textContent.length,
    lengthKB: (textContent.length / 1024).toFixed(2),
    wordCount: textContent
      .trim()
      .split(/\s+/)
      .filter((word) => word.length > 0).length
  }
}

/**
 * Log a backend failure and return the appropriate Hapi error response.
 */
function handleBackendFailure(
  response,
  sourceType,
  textInfo,
  backendRequestTime,
  h
) {
  const backendContentType = response.headers?.get('content-type') ?? ''
  logger.error('Backend text review request failed', {
    status: response.status,
    statusText: response.statusText,
    contentType: backendContentType,
    backendRequestTime,
    sourceType: sourceType || 'text',
    contentLengthKB: textInfo.lengthKB
  })
  return h
    .response({
      success: false,
      message: 'Failed to submit text content to backend'
    })
    .code(HTTP_STATUS.INTERNAL_SERVER_ERROR)
}

/**
 * Handle errors from the text review submission.
 */
function handleTextReviewError(h, error, startTime) {
  const totalProcessingTime = (Date.now() - startTime) / 1000

  if (error.name === 'AbortError') {
    logger.error(
      { timeoutMs: BACKEND_TIMEOUT_MS, totalProcessingTime },
      `[TIMEOUT] Text review backend request timed out after ${BACKEND_TIMEOUT_MS / 1000}s — totalProcessingTime: ${totalProcessingTime}s`
    )
    return h
      .response({
        success: false,
        message: 'The request timed out. Please try again.'
      })
      .code(HTTP_STATUS.INTERNAL_SERVER_ERROR)
  }

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

/**
 * Handle text content submission for review
 */
async function reviewText(request, h) {
  const startTime = Date.now()

  try {
    const { textContent, title, sourceType, sourceUrl } = request.payload

    const validationError = validateTextContent(textContent, h)
    if (validationError) {
      return validationError
    }

    const finalTitle = generateTitle(textContent, title)
    const textInfo = getTextInfo(textContent)

    logger.info(
      {
        sourceType: sourceType || 'text',
        contentLengthKB: textInfo.lengthKB,
        title: finalTitle,
        hasSourceUrl: !!sourceUrl
      },
      `Forwarding text review to backend (${textInfo.lengthKB} KB, sourceType=${sourceType || 'text'})`
    )

    const { response, backendRequestTime } = await submitToBackend(
      textContent,
      finalTitle,
      request,
      sourceType,
      sourceUrl
    )

    if (!response.ok) {
      return handleBackendFailure(
        response,
        sourceType,
        textInfo,
        backendRequestTime,
        h
      )
    }

    const result = await response.json()
    const totalProcessingTime = (Date.now() - startTime) / 1000

    logger.info('[RESPONSE TIME] Text review request successful', {
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
    return handleTextReviewError(h, error, startTime)
  }
}

export const textReviewApiController = {
  reviewText
}
