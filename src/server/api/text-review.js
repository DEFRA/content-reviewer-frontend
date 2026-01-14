import fetch from 'node-fetch'
import { config } from '../../config/config.js'

/**
 * API controller for handling text content reviews
 */
export const textReviewApiController = {
  /**
   * Handle text content submission for review
   */
  async reviewText(request, h) {
    try {
      const { textContent } = request.payload

      if (!textContent || typeof textContent !== 'string') {
        return h
          .response({
            success: false,
            message: 'No text content provided'
          })
          .code(400)
      }

      // Validate text content length (max 50,000 characters)
      const maxLength = 50000
      if (textContent.length > maxLength) {
        return h
          .response({
            success: false,
            message: `Text content too long. Maximum ${maxLength} characters. Your content has ${textContent.length} characters.`
          })
          .code(400)
      }

      // Minimum content check
      if (textContent.trim().length < 10) {
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

      request.logger.info(
        `Submitting text content to backend: ${textContent.length} characters`
      )

      const response = await fetch(`${backendUrl}/api/review-text`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          textContent,
          userId: request.headers['x-user-id'] || 'anonymous',
          sessionId: request.headers['x-session-id'] || null
        })
      })

      if (!response.ok) {
        const error = await response.text()
        request.logger.error(`Backend text review failed: ${error}`)
        return h
          .response({
            success: false,
            message: 'Failed to submit text content to backend'
          })
          .code(500)
      }

      const result = await response.json()

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
