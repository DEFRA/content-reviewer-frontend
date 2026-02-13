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
      const requestStartTime = performance.now()
      const config = request.server.app.config
      const backendUrl = config.get('backendUrl')

      // Fetch review status and results from backend
      request.logger.info(
        { reviewId },
        `[FRONTEND] Requesting review results from backend - START`
      )

      const fetchStart = performance.now()
      const response = await fetch(`${backendUrl}/api/results/${reviewId}`)
      const fetchDuration = Math.round(performance.now() - fetchStart)

      const parseStart = performance.now()
      const apiResponse = await response.json()
      const parseDuration = Math.round(performance.now() - parseStart)

      request.logger.info(
        {
          reviewId,
          fetchDurationMs: fetchDuration,
          parseDurationMs: parseDuration,
          status: response.status
        },
        `[FRONTEND] Backend response received in ${fetchDuration}ms (parse: ${parseDuration}ms)`
      )

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
      const transformStart = performance.now()
      const reviewResults = transformReviewData(statusData, reviewId)
      const transformDuration = Math.round(performance.now() - transformStart)

      const totalDuration = Math.round(performance.now() - requestStartTime)

      request.logger.info(
        {
          reviewId,
          totalDurationMs: totalDuration,
          fetchMs: fetchDuration,
          parseMs: parseDuration,
          transformMs: transformDuration
        },
        `[FRONTEND] Results page rendered - TOTAL: ${totalDuration}ms (Fetch: ${fetchDuration}ms, Parse: ${parseDuration}ms, Transform: ${transformDuration}ms)`
      )

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
  // Backend returns: { result: { reviewData, rawResponse, guardrailAssessment, stopReason, completedAt } }
  const backendResult = statusData.result || {}

  return {
    id: statusData.id || reviewId,
    jobId: statusData.jobId,
    status: statusData.status,
    result: {
      reviewData: backendResult.reviewData || null,
      reviewContent: backendResult.rawResponse || null,
      guardrailAssessment: backendResult.guardrailAssessment || null,
      stopReason: backendResult.stopReason || null
    },
    completedAt: statusData.completedAt
  }
}
