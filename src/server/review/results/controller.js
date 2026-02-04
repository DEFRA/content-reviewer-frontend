import {
  validateContentSafe,
  logPIIDetection
} from '../../common/helpers/pii-sanitizer.js'

export const resultsController = {
  handler: async (request, h) => {
    const { id: reviewId } = request.params

    if (!reviewId) {
      request.logger.warn('Missing review id for results route')
      return h
        .response({
          success: false,
          error: 'Review id is required in the URL',
          message:
            'Please navigate via a valid review link that includes the id.'
        })
        .code(400)
    }

    try {
      const config = request.server.app.config
      const backendUrl = config.get('backendUrl')

      // Fetch review status and results from backend
      request.logger.info(
        `Requesting review results from backend: ${backendUrl}/api/results/${reviewId}`
      )
      const response = await fetch(`${backendUrl}/api/results/${reviewId}`)
      const apiResponse = await response.json()

      if (!response.ok) {
        request.logger.error(
          { reviewId, status: response.status },
          'Backend returned error status'
        )
        throw new Error(`Failed to fetch review results: ${response.status}`)
      }
      if (!apiResponse.success) {
        request.logger.error({ reviewId, apiResponse }, 'Invalid API response')
        throw new Error('Invalid response from backend')
      }
      // Reuse existing variable names, adapt backend shape if needed
      const statusData = apiResponse.data || {
        status: apiResponse.status,
        result: apiResponse.result,
        completedAt: apiResponse.completedAt,
        failedAt: apiResponse.failedAt,
        reviewId: apiResponse.jobId
      }

      // Check if review is completed
      if (statusData.status !== 'completed') {
        return h.view('review/results/pending', {
          pageTitle: 'Review In Progress',
          heading: 'Review In Progress',
          reviewId: statusData.reviewId,
          currentStatus: statusData.status,
          progress: statusData.progress || 0
        })
      }

      // Transform backend data to frontend format (only fields used by the template)
      const reviewResults = transformReviewData(statusData, reviewId)

      // ============================================
      // SECURITY: VALIDATE NO UNREDACTED PII IN RESPONSE
      // ============================================
      if (reviewResults.result?.reviewContent) {
        const validation = validateContentSafe(
          reviewResults.result.reviewContent,
          'reviewContent'
        )

        if (!validation.safe) {
          // Log security warning
          logPIIDetection('reviewContent', validation.detectedPatterns)

          // In production, you might want to block display or sanitize further
          request.logger.error(
            {
              reviewId,
              detectedPatterns: validation.detectedPatterns,
              warning: validation.warning
            },
            '[PII SECURITY ALERT] Unredacted PII detected in review content'
          )
        }
      }

      return h.view('review/results/index', {
        pageTitle: 'Review Results',
        heading: 'AI Content Review Results',
        reviewId,
        results: reviewResults
      })
    } catch (error) {
      request.logger.error(
        {
          error: error.message,
          errorName: error.name,
          errorCode: error.code,
          stack: error.stack,
          reviewId
        },
        'Failed to fetch review results'
      )

      return h.view('review/results/error', {
        pageTitle: 'Error',
        heading: 'Error Loading Results',
        error:
          'Unable to load review results. The backend service may be unavailable. Please try again later.'
      })
    }
  }
}

/**
 * Transform backend status data to frontend display format
 */
function transformReviewData(statusData, reviewId) {
  // Only consume and expose the API response attributes provided
  // { id, jobId, status, result: { reviewContent, guardrailAssessment, stopReason, completedAt }, completedAt }

  const safeResult = statusData.result || {}

  return {
    id: statusData.id || reviewId,
    jobId: statusData.jobId,
    status: statusData.status,
    result: {
      reviewContent: safeResult.reviewContent,
      guardrailAssessment: safeResult.guardrailAssessment,
      stopReason: safeResult.stopReason
    },
    completedAt: statusData.completedAt
  }
}
