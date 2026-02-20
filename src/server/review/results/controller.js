const HTTP_STATUS_BAD_REQUEST = 400

export const resultsController = {
  handler: async (request, h) => {
    const { id: reviewId } = request.params

    if (!reviewId) {
      return handleMissingReviewId(request, h)
    }

    const requestStartTime = performance.now()
    try {
      const { statusData, fetchDuration, parseDuration } =
        await fetchAndParseBackendResults(request, reviewId)

      if (statusData.status !== 'completed') {
        return renderPendingView(h, statusData)
      }

      const transformStart = performance.now()
      const reviewResults = transformReviewData(statusData, reviewId)
      const transformDuration = Math.round(performance.now() - transformStart)
      const totalDuration = Math.round(performance.now() - requestStartTime)

      // 🔍 DEBUG: Log transformed data before rendering
      request.logger.info(
        `DEBUG [FRONTEND-CONTROLLER] Transformed reviewResults: ${JSON.stringify(reviewResults).substring(0, 1000)}`
      )
      request.logger.info(
        `DEBUG [FRONTEND-CONTROLLER] reviewResults.result.reviewData exists: ${!!reviewResults.result?.reviewData}, type: ${typeof reviewResults.result?.reviewData}`
      )

      logResultsPageRender(
        request,
        reviewId,
        totalDuration,
        fetchDuration,
        parseDuration,
        transformDuration
      )

      return renderResultsView(h, reviewId, reviewResults)
    } catch (error) {
      return handleResultsError(request, h, error, reviewId)
    }
  }
}

function handleMissingReviewId(request, h) {
  request.logger.warn('Missing review id for results route')
  return h
    .response({
      success: false,
      error: 'Review id is required in the URL'
    })
    .code(HTTP_STATUS_BAD_REQUEST)
}

async function fetchAndParseBackendResults(request, reviewId) {
  const config = request.server.app.config
  const backendUrl = config.get('backendUrl')

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
  const statusData = apiResponse.data || {
    status: apiResponse.status,
    result: apiResponse.result,
    completedAt: apiResponse.completedAt,
    failedAt: apiResponse.failedAt,
    reviewId: apiResponse.jobId
  }

  // 🔍 DEBUG: Log what frontend received from backend
  request.logger.info(
    `DEBUG [FRONTEND-CONTROLLER] Raw backend response: ${JSON.stringify(statusData).substring(0, 1000)}`
  )

  // 🔍 DEBUG: Log specific nested properties
  request.logger.info(
    `DEBUG [FRONTEND-CONTROLLER] statusData.result exists: ${!!statusData.result}, statusData.result.reviewData exists: ${!!statusData.result?.reviewData}`
  )

  if (statusData.result) {
    request.logger.info(
      `DEBUG [FRONTEND-CONTROLLER] statusData.result keys: ${JSON.stringify(Object.keys(statusData.result))}`
    )
    request.logger.info(
      `DEBUG [FRONTEND-CONTROLLER] statusData.result.reviewData: ${JSON.stringify(statusData.result.reviewData).substring(0, 1000)}`
    )
  }

  return { statusData, fetchDuration, parseDuration }
}

function renderPendingView(h, statusData) {
  return h.view('review/results/pending', {
    pageTitle: 'Review In Progress',
    heading: 'Review In Progress',
    reviewId: statusData.reviewId,
    currentStatus: statusData.status,
    progress: statusData.progress || 0
  })
}

function renderResultsView(h, reviewId, reviewResults) {
  return h.view('review/results/index', {
    pageTitle: 'Review Results',
    heading: 'AI Content Review Results',
    reviewId,
    results: reviewResults
  })
}

function logResultsPageRender(
  request,
  reviewId,
  totalDuration,
  fetchDuration,
  parseDuration,
  transformDuration
) {
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
}

function handleResultsError(request, h, error, reviewId) {
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

/**
 * Transform backend status data to frontend display format
 */
function transformReviewData(statusData, reviewId) {
  // Backend returns: { result: { reviewData, rawResponse, guardrailAssessment, stopReason, completedAt } }
  const backendResult = statusData.result || {}

  // 🔍 DEBUG: Log transformation input and output
  console.log(
    `DEBUG [TRANSFORM] Input backendResult: ${JSON.stringify(backendResult).substring(0, 500)}`
  )
  console.log(
    `DEBUG [TRANSFORM] backendResult.reviewData: ${JSON.stringify(backendResult.reviewData).substring(0, 500)}`
  )

  const transformed = {
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

  console.log(
    `DEBUG [TRANSFORM] Output transformed.result.reviewData: ${JSON.stringify(transformed.result.reviewData).substring(0, 500)}`
  )

  return transformed
}
