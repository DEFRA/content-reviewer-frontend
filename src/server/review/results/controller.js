const HTTP_STATUS_BAD_REQUEST = 400
const PROGRESS_PROCESSING = 50
const SCORE_DISPLAY_SCALE = 20 // converts 0-100 envelope scores back to 0-5 for "X/5" display

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
          isGuardrailBlock ? 'Content blocked by AI guardrails.' : null
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
        `[FRONTEND] Results page rendered - TOTAL: ${totalDuration}ms`
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
    `[FRONTEND] Result envelope received in ${fetchDuration}ms`
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
 *   results.scores                            - flat { accessibility, style, tone, overall }
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
          // annotatedSections drives the highlighted content display
          annotatedSections: envelope.annotatedSections || [],
          // issues for any direct issue-list rendering
          issues: envelope.issues || []
        },
        improvements: envelope.improvements || []
      }
    }
  }
}

/**
 * Convert the scores object from the result envelope into the
 * { Label: { score, note } } map that review-output.njk iterates over.
 *
 * Supports both the new five-category schema and the legacy three-key schema.
 * Converts 0-100 values back to 0-5 scale for the "X/5" scorecard display.
 */
function buildScoresMap(flatScores) {
  // Five-category schema (preferred) — exactly five categories, no Overall row
  const categoryMap = [
    {
      key: 'plainEnglish',
      noteKey: 'plainEnglishNote',
      label: 'Plain English'
    },
    { key: 'clarity', noteKey: 'clarityNote', label: 'Clarity & Structure' },
    {
      key: 'accessibility',
      noteKey: 'accessibilityNote',
      label: 'Accessibility'
    },
    {
      key: 'govukStyle',
      noteKey: 'govukStyleNote',
      label: 'GOV.UK Style Compliance'
    },
    {
      key: 'completeness',
      noteKey: 'completenessNote',
      label: 'Content Completeness'
    }
  ]

  const map = {}
  for (const { key, noteKey, label } of categoryMap) {
    if (flatScores[key] !== undefined) {
      map[label] = {
        score: Math.round(flatScores[key] / SCORE_DISPLAY_SCALE),
        note: noteKey ? flatScores[noteKey] || '' : ''
      }
    }
  }

  // Fallback: legacy three-key schema (style / tone / overall)
  if (Object.keys(map).length === 0) {
    const legacyMap = {
      accessibility: 'Accessibility',
      style: 'Style',
      tone: 'Tone',
      overall: 'Overall'
    }
    for (const [key, label] of Object.entries(legacyMap)) {
      if (flatScores[key] !== undefined) {
        map[label] = {
          score: Math.round(flatScores[key] / SCORE_DISPLAY_SCALE),
          note: ''
        }
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
