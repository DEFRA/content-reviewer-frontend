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
    logger.info('Text review API request started')

    try {
      const { textContent, title } = request.payload

      logger.info('Processing text review request', {
        hasTextContent: !!textContent,
        hasTitle: !!title,
        title: title,
        contentType: typeof textContent,
        userAgent: request.headers['user-agent'],
        clientIP: request.info.remoteAddress
      })

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

      logger.info('Text content received for processing', textInfo)

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

      logger.info('Text content validation passed successfully', textInfo)

      // Forward to backend
      const backendUrl = config.get('backendUrl')
      logger.info('Preparing to forward text content to backend', {
        backendUrl
      })

      const backendRequestStart = Date.now()
      logger.info('Initiating backend text review request', {
        contentLength: textInfo.length,
        wordCount: textInfo.wordCount,
        backendEndpoint: `${backendUrl}/api/review/text`
      })

      request.logger.info(
        `Submitting text content to backend: ${textContent.length} characters`
      )

      const response = await fetch(`${backendUrl}/api/review/text`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          content: textContent,
          title:
            title ||
            textContent.substring(0, 10).trim() +
              (textContent.length > 10 ? '...' : ''),
          userId: request.headers['x-user-id'] || 'anonymous',
          sessionId: request.headers['x-session-id'] || null
        })
      })

      const backendRequestEnd = Date.now()
      const backendRequestTime =
        (backendRequestEnd - backendRequestStart) / 1000

      logger.info('Backend text review request completed', {
        contentLength: textInfo.length,
        responseStatus: response.status,
        responseStatusText: response.statusText,
        requestTime: `${backendRequestTime}s`,
        success: response.ok
      })

      if (!response.ok) {
        const error = await response.text()
        logger.error('Backend text review request failed', {
          contentLength: textInfo.length,
          status: response.status,
          statusText: response.statusText,
          errorResponse: error,
          requestTime: `${backendRequestTime}s`
        })
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

      logger.info('Text review completed successfully', {
        contentLength: textInfo.length,
        wordCount: textInfo.wordCount,
        reviewId: result.reviewId,
        totalProcessingTime: `${totalProcessingTime}s`,
        backendRequestTime: `${backendRequestTime}s`
      })

      request.logger.info(
        `Text content submitted successfully: ${result.reviewId || 'unknown'}`
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

      logger.error('Text review API request failed with error', {
        error: error.message,
        stack: error.stack,
        totalProcessingTime: `${totalProcessingTime}s`
      })

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
