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

      request.logger.info(
        {
          reviewId,
          backendUrl,
          fullUrl: `${backendUrl}/api/results/${reviewId}`
        },
        'Fetching review results from backend'
      )

      // Fetch review status and results from backend
      const response = await fetch(`${backendUrl}/api/results/${reviewId}`)
      request.logger.info(
        {
          reviewId,
          fetchUrl: `${backendUrl}/api/results/${reviewId}`,
          status: response.status
        },
        'Backend results fetch completed'
      )
      const apiResponse = await response.json()

      request.logger.info(
        {
          reviewId,
          hasReviewContent: !!apiResponse?.result?.reviewContent
        },
        'Review response retrieved from backend'
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
        failedAt: apiResponse.failedAt
      }

      // Check if review is completed
      if (statusData.status !== 'completed') {
        request.logger.info(
          { reviewId, status: statusData.status },
          'Review not completed yet'
        )
        return h.view('review/results/pending', {
          pageTitle: 'Review In Progress',
          heading: 'Review In Progress',
          reviewId,
          currentStatus: statusData.status,
          progress: statusData.progress || 0
        })
      }

      request.logger.info({ reviewId }, 'Transforming review data')
      // Transform backend data to frontend format
      const reviewResults = transformReviewData(statusData)

      request.logger.info(
        {
          reviewId,
          documentName: reviewResults.documentName,
          hasS3Location: !!reviewResults.s3Location,
          hasSections: !!reviewResults.sections,
          sectionKeys: reviewResults.sections
            ? Object.keys(reviewResults.sections)
            : []
        },
        'Rendering results view'
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
function transformReviewData(statusData) {
  // Only consume and expose the API response attributes provided
  // { id, jobId, status, result: { reviewContent, guardrailAssessment, stopReason, completedAt }, completedAt }

  const safeResult = statusData.result || {}

  return {
    id: statusData.id,
    jobId: statusData.jobId,
    status: statusData.status,
    result: {
      reviewContent: safeResult.reviewContent,
      guardrailAssessment: safeResult.guardrailAssessment,
      stopReason: safeResult.stopReason
    },
    completedAt: statusData.completedAt,

    // Keep raw data for export buttons
    rawData: statusData
  }
}

/**
 * Calculate overall score from status
 */
// Note: helpers removed as transform no longer derives summary/timing
