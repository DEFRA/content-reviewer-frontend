const HTTP_STATUS_BAD_REQUEST = 400
const PROGRESS_PROCESSING = 50

export const resultsController = {
  handler: async (request, h) => {
    const { id: reviewId } = request.params

    if (!reviewId) {
      return handleMissingReviewId(request, h)
    }

    const requestStartTime = performance.now()
    try {
      const { envelope, fetchDuration } = await fetchResultEnvelope(
        request,
        reviewId
      )

      if (envelope.status === 'pending' || envelope.status === 'processing') {
        return renderPendingView(h, envelope)
      }

      if (envelope.status === 'failed') {
        const isGuardrailBlock =
          envelope.errorMessage?.toLowerCase().includes('guardrail') ||
          envelope.errorMessage?.toLowerCase().includes('blocked')
        return renderErrorView(
          h,
          'The review failed to process. Please try again.',
          isGuardrailBlock
            ? 'Content blocked due to sensitive PII content.'
            : null
        )
      }

      const transformStart = performance.now()
      const reviewResults = transformEnvelopeToViewData(envelope, reviewId)
      const transformDuration = Math.round(performance.now() - transformStart)
      const totalDuration = Math.round(performance.now() - requestStartTime)

      request.logger.info(
        {
          reviewId,
          totalDurationMs: totalDuration,
          fetchMs: fetchDuration,
          transformMs: transformDuration,
          issueCount: envelope.issueCount,
          status: envelope.status
        },
        `[RESPONSE TIME] [FRONTEND] Results page rendered - TOTAL: ${totalDuration}ms`
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
    .response({ success: false, error: 'Review id is required in the URL' })
    .code(HTTP_STATUS_BAD_REQUEST)
}

/**
 * Fetch result/{reviewId}.json envelope from the backend API.
 */
async function fetchResultEnvelope(request, reviewId) {
  const config = request.server.app.config
  const backendUrl = config.get('backendUrl')

  request.logger.info(
    { reviewId },
    '[FRONTEND] Fetching result envelope from backend'
  )

  const fetchStart = performance.now()
  const response = await fetch(`${backendUrl}/api/result/${reviewId}`)
  const fetchDuration = Math.round(performance.now() - fetchStart)

  if (!response.ok) {
    throw new Error(`Backend returned ${response.status} for result envelope`)
  }

  const body = await response.json()

  if (!body.success) {
    throw new Error('Invalid response from backend result endpoint')
  }

  request.logger.info(
    {
      reviewId,
      status: body.data?.status,
      issueCount: body.data?.issueCount,
      fetchDurationMs: fetchDuration
    },
    `[RESPONSE TIME] [FRONTEND] Result envelope received in ${fetchDuration}ms`
  )

  return { envelope: body.data, fetchDuration }
}

/**
 * Transform the spec envelope into the shape the Nunjucks templates expect.
 *
 * The review-output.njk template uses:
 *   results.result.reviewData.scores          - { Label: { score, note } }
 *   results.result.reviewData.reviewedContent
 *     .annotatedSections                      - [{ text, issueIdx, category }]
 *     .issues                                 - spec issues[]
 *   results.result.reviewData.improvements    - spec improvements[]
 *   results.issueCount
 *   results.scores                            - flat { plainEnglish, govukStyle }
 *   results.processedAt
 *   results.tokenUsed
 */
function transformEnvelopeToViewData(envelope, reviewId) {
  // Re-hydrate scores as a display map (0-100 → "X/5" shown by template)
  const scoresMap = buildScoresMap(envelope.scores || {})

  return {
    id: reviewId,
    status: envelope.status,
    processedAt: envelope.processedAt,
    tokenUsed: envelope.tokenUsed,
    issueCount: envelope.issueCount,
    scores: envelope.scores,
    result: {
      reviewData: {
        scores: scoresMap,
        reviewedContent: {
          annotatedSections: envelope.annotatedSections || []
        },
        improvements: envelope.improvements || []
      }
    }
  }
}

/**
 * Convert the scores object from the result envelope into the
 * { Label: { score, note } } map that review-output.njk iterates over.
 * Scores are already stored as 1–5 in the envelope.
 */
function buildScoresMap(flatScores) {
  const categoryMap = [
    {
      key: 'plainEnglish',
      noteKey: 'plainEnglishNote',
      label: 'Plain English'
    },
    {
      key: 'govukStyle',
      noteKey: 'govukStyleNote',
      label: 'GOV.UK Style Compliance'
    }
  ]

  const map = {}
  for (const { key, noteKey, label } of categoryMap) {
    if (flatScores[key] !== undefined) {
      map[label] = {
        score: flatScores[key],
        note: flatScores[noteKey] || ''
      }
    }
  }

  return map
}

function renderPendingView(h, envelope) {
  return h.view('review/results/pending', {
    pageTitle: 'Review In Progress',
    heading: 'Review In Progress',
    reviewId: envelope.documentId,
    currentStatus: envelope.status,
    progress: envelope.status === 'processing' ? PROGRESS_PROCESSING : 0
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

function renderErrorView(h, message, errorDetail = null) {
  return h.view('review/results/error', {
    pageTitle: 'Error',
    heading: 'Error Loading Results',
    error: message,
    errorDetail
  })
}

function handleResultsError(request, h, error, reviewId) {
  request.logger.error(
    {
      error: error.message,
      errorName: error.name,
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
