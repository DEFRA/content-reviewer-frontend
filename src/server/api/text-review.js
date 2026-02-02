import fetch from 'node-fetch'
import { config } from '../../config/config.js'
import { createLogger } from '../common/helpers/logging/logger.js'

const logger = createLogger()

/**
 * API controller for handling text content reviews
 */
export const textReviewApiController = {
  /**
   * Handle text content submission for review
   */
  async reviewText(request, h) {
    const startTime = Date.now()

    try {
      const { textContent, title } = request.payload

      if (!textContent || typeof textContent !== 'string') {
        logger.warn(
          'Text review request failed: No valid text content provided'
        )
        return h
          .response({
            success: false,
            message: 'No text content provided'
          })
          .code(400)
      }

      const textInfo = {
        length: textContent.length,
        lengthKB: (textContent.length / 1024).toFixed(2),
        preview:
          textContent.substring(0, 50) + (textContent.length > 50 ? '...' : ''),
        wordCount: textContent.split(/\s+/).filter((word) => word.length > 0)
          .length
      }

      // Validate text content length (max 50,000 characters)
      const maxLength = 50000
      if (textContent.length > maxLength) {
        logger.warn('Text review validation failed: Content too long', {
          length: textInfo.length,
          maxLength,
          preview: textInfo.preview
        })
        return h
          .response({
            success: false,
            message: `Text content too long. Maximum ${maxLength} characters. Your content has ${textContent.length} characters.`
          })
          .code(400)
      }

      // Minimum content check
      if (textContent.trim().length < 10) {
        logger.warn('Text review validation failed: Content too short', {
          trimmedLength: textContent.trim().length,
          originalLength: textInfo.length
        })
        return h
          .response({
            success: false,
            message:
              'Text content too short. Please provide at least 10 characters.'
          })
          .code(400)
      }

      // Forward to backend
      const backendUrl = config.get('backendUrl')
      logger.info(
        `Requesting text review from backend: ${backendUrl}/api/review/text`
      )

      const backendRequestStart = Date.now()

      // Generate title from first 3 words if not provided
      let finalTitle = title
      if (!finalTitle) {
        const words = textContent
          .trim()
          .split(/\s+/)
          .filter((w) => w.length > 0)
        finalTitle =
          words.length > 0
            ? words.slice(0, 3).join(' ').substring(0, 50) + '...'
            : 'Text Content'
      }

      const response = await fetch(`${backendUrl}/api/review/text`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          content: textContent,
          title: finalTitle,
          userId: request.headers['x-user-id'] || 'anonymous',
          sessionId: request.headers['x-session-id'] || null
        })
      })

      const backendRequestEnd = Date.now()
      const backendRequestTime =
        (backendRequestEnd - backendRequestStart) / 1000

      if (!response.ok) {
        const error = await response.text()
        logger.error(
          `Backend text review request failed - contentLength: ${textInfo.length}, status: ${response.status}, statusText: ${response.statusText}, errorResponse: ${error}, requestTime: ${backendRequestTime}s`
        )
        request.logger.error(`Backend text review failed: ${error}`)
        return h
          .response({
            success: false,
            message: 'Failed to submit text content to backend'
          })
          .code(500)
      }

      const result = await response.json()
      const totalProcessingTime = (Date.now() - startTime) / 1000

      logger.info(
        `Text review completed successfully - contentLength: ${textInfo.length}, wordCount: ${textInfo.wordCount}, reviewId: ${result.reviewId}, totalProcessingTime: ${totalProcessingTime}s, backendRequestTime: ${backendRequestTime}s`
      )

      return h
        .response({
          success: true,
          message: 'Text content submitted successfully',
          reviewId: result.reviewId
        })
        .code(200)
    } catch (error) {
      const totalProcessingTime = (Date.now() - startTime) / 1000

      logger.error(
        `Text review API request failed with error - error: ${error.message}, totalProcessingTime: ${totalProcessingTime}s`,
        {
          stack: error.stack
        }
      )

      request.logger.error(error, 'Error handling text content submission')
      return h
        .response({
          success: false,
          message: error.message || 'Internal server error'
        })
        .code(500)
    }
  }
}
