export const resultsController = {
  handler: async (request, h) => {
    const { id } = request.params

    try {
      const config = request.server.app.config
      const backendUrl = config.get('backendUrl')

      request.logger.info(
        {
          reviewId: id,
          backendUrl,
          fullUrl: `${backendUrl}/api/results/${id}`
        },
        'Fetching review results from backend'
      )

      // Fetch review status and results from backend
      const response = await fetch(`${backendUrl}/api/results/${id}`)
      const data = await response.json()

      request.logger.info(
        { reviewId: id, response: data.result.reviewContent },
        'Review response retrieved from S3 frontend'
      )

      if (!response.ok) {
        request.logger.error(
          { reviewId: id, status: response.status },
          'Backend returned error status'
        )
        throw new Error(`Failed to fetch review results: ${response.status}`)
      }

      const apiResponse = await response.json()
      request.logger.info(
        { reviewId: id, hasData: !!apiResponse.data },
        'Received API response'
      )

      if (!apiResponse.success || !apiResponse.data) {
        request.logger.error(
          { reviewId: id, apiResponse },
          'Invalid API response'
        )
        throw new Error('Invalid response from backend')
      }

      const statusData = apiResponse.data

      // Check if review is completed
      if (statusData.status !== 'completed') {
        request.logger.info(
          { reviewId: id, status: statusData.status },
          'Review not completed yet'
        )
        return h.view('review/results/pending', {
          pageTitle: 'Review In Progress',
          heading: 'Review In Progress',
          reviewId: id,
          currentStatus: statusData.status,
          progress: statusData.progress || 0
        })
      }

      request.logger.info({ reviewId: id }, 'Transforming review data')
      // Transform backend data to frontend format
      const reviewResults = transformReviewData(statusData)

      request.logger.info(
        {
          reviewId: id,
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
        reviewId: id,
        results: reviewResults
      })
    } catch (error) {
      request.logger.error(
        {
          error: error.message,
          errorName: error.name,
          errorCode: error.code,
          stack: error.stack,
          reviewId: id
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
  // Extract review result from the backend response
  const reviewResult = statusData.result || {}
  const metadata = statusData.metadata || {}

  // Extract sections from the review result
  const sections = reviewResult.sections || {}
  const metrics = reviewResult.metrics || {}
  const aiMetadata = reviewResult.aiMetadata || {}

  return {
    documentName: statusData.filename || 'Unknown Document',
    reviewDate:
      statusData.completedAt ||
      statusData.updatedAt ||
      new Date().toISOString(),
    status: reviewResult.overallStatus || 'completed',
    responseData: reviewResult.reviewContent || 'No data',
    s3Location: metadata.s3Key
      ? `${metadata.bucket}/${metadata.s3Key}`
      : statusData.s3ResultLocation || 'N/A',
    s3ResultLocation: statusData.s3ResultLocation || 'N/A',
    llmModel: aiMetadata.model || 'Claude 3.7 Sonnet',
    inferenceProfile: aiMetadata.inferenceProfile || 'N/A',
    processingTime: calculateProcessingTime(
      statusData.createdAt,
      statusData.completedAt
    ),

    // Summary metrics
    summary: {
      overallScore: calculateOverallScore(reviewResult.overallStatus),
      overallStatus: reviewResult.overallStatus || 'unknown',
      issuesFound: metrics.totalIssues || 0,
      wordsToAvoid: metrics.wordsToAvoidCount || 0,
      passiveSentences: metrics.passiveSentencesCount || 0,
      wordCount: metrics.wordCount || metadata.wordCount || 0
    },

    // AI usage metrics
    aiUsage: {
      inputTokens: aiMetadata.inputTokens || 0,
      outputTokens: aiMetadata.outputTokens || 0,
      totalTokens:
        (aiMetadata.inputTokens || 0) + (aiMetadata.outputTokens || 0)
    },

    // Review sections from Bedrock AI response
    sections: {
      overallAssessment:
        sections.overallAssessment || 'No assessment available',
      contentQuality: sections.contentQuality || 'No data',
      plainEnglish: sections.plainEnglishReview || 'No data',
      styleGuide: sections.styleGuideCompliance || 'No data',
      govspeak: sections.govspeakReview || 'No data',
      accessibility: sections.accessibilityReview || 'No data',
      passiveVoice: sections.passiveVoiceReview || 'No data',
      summaryOfFindings: sections.summaryOfFindings || 'No data',
      exampleImprovements: sections.exampleImprovements || 'No data'
    },

    // Full review text from Bedrock AI
    fullReviewText:
      reviewResult.reviewText ||
      reviewResult.fullReview ||
      'No review text available',

    // Raw data for export
    rawData: statusData
  }
}

/**
 * Calculate overall score from status
 */
function calculateOverallScore(status) {
  const scoreMap = {
    pass: 95,
    pass_with_recommendations: 80,
    needs_improvement: 60,
    fail: 40,
    unknown: 0
  }
  return scoreMap[status] || 0
}

/**
 * Calculate processing time
 */
function calculateProcessingTime(startTime, endTime) {
  if (!startTime || !endTime) return 'N/A'

  const start = new Date(startTime)
  const end = new Date(endTime)
  const diffMs = end - start
  const diffSec = Math.round(diffMs / 1000)

  if (diffSec < 60) {
    return `${diffSec} seconds`
  } else {
    const minutes = Math.floor(diffSec / 60)
    const seconds = diffSec % 60
    return `${minutes}m ${seconds}s`
  }
}
