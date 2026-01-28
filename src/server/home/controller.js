/**
 * A GDS styled example home page controller.
 * Provided as an example, remove or modify as required.
 */
import { createLogger } from '../common/helpers/logging/logger.js'

const logger = createLogger()

export const homeController = {
  async handler(request, h) {
    const startTime = Date.now()
    const timestamp = new Date().toISOString()

    logger.info('Home page request started', { timestamp })
    console.log('[HOME-CONTROLLER] Processing home page request')

    // Get flash messages from session
    const uploadSuccess = request.yar.flash('uploadSuccess')
    const uploadError = request.yar.flash('uploadError')

    // ALSO check session flag that we're setting in upload controller
    const hasUploadSuccessFlag = request.yar.get('hasUploadSuccess')

    logger.info('Flash messages retrieved', {
      hasUploadSuccess: uploadSuccess.length > 0,
      hasUploadError: uploadError.length > 0,
      sessionUploadFlag: hasUploadSuccessFlag
    })

    // Get backend URL from config
    const config = request.server.app.config
    const backendUrl = config.get('backendUrl')

    logger.info('Configuration retrieved', { backendUrl })

    // Fetch review history from backend
    // Default to 5, but support limit query param for future use
    const limit = parseInt(request.query.limit) || 5
    let reviewHistory = []
    try {
      const backendRequestStart = Date.now()

      logger.info('Initiating review history fetch for home page', {
        endpoint: `${backendUrl}/api/reviews?limit=${limit}`
      })

      const response = await fetch(`${backendUrl}/api/reviews?limit=${limit}`)

      const backendRequestEnd = Date.now()
      const backendRequestTime =
        (backendRequestEnd - backendRequestStart) / 1000

      logger.info('Review history fetch response received', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
        requestTime: `${backendRequestTime}s`
      })

      if (response.ok) {
        const data = await response.json()

        logger.info('Response from backend for review history', {
          reviewsCount: data.reviews?.length || 0
        })

        // Normalize and log missing IDs to catch "Missing review ID" links
        const normalized = (data.reviews || []).map((r) => ({
          ...r,
          id: r.id || r.reviewId || r.jobId || r._id,
          reviewId: r.reviewId || r.id || r.jobId || r._id,
          filename: r.fileName || r.filename || 'Text Content', // map fileName to filename
          uploadedAt: r.createdAt || r.updatedAt || r.uploadedAt || null // map createdAt/updatedAt to uploadedAt
        }))

        const missingId = normalized.filter((r) => !r.id && !r.reviewId)

        reviewHistory = normalized

        logger.info('Review history retrieved successfully', {
          count: reviewHistory.length,
          totalFromResponse: data.total || data.count || 0,
          requestTime: `${backendRequestTime}s`,
          missingIdCount: missingId.length
        })
        if (missingId.length > 0) {
          logger.warn(
            {
              missingIdCount: missingId.length,
              sample: missingId.slice(0, 3)
            },
            'Review history entries missing reviewId'
          )
        }
      } else {
        logger.warn('Review history fetch failed with non-ok status', {
          status: response.status,
          requestTime: `${backendRequestTime}s`
        })
      }
    } catch (error) {
      logger.error('Failed to fetch review history for home page', {
        message: error.message,
        stack: error.stack,
        backendUrl
      })
      request.logger.error(
        error,
        'Failed to fetch review history for home page'
      )
      // Continue with empty history - don't break the page
    }

    const viewData = {
      pageTitle: 'Home',
      heading: 'Home',
      uploadSuccess: uploadSuccess.length > 0 ? uploadSuccess[0] : null,
      uploadError: uploadError.length > 0 ? uploadError[0] : null,
      reviewHistory,
      backendUrl, // Pass to template for client-side use
      cacheBuster: Date.now(), // Add cacheBuster for template
      currentLimit: limit // Pass the current limit to template
    }

    const totalProcessingTime = (Date.now() - startTime) / 1000

    logger.info('Home page rendering completed', {
      hasUploadSuccess: !!viewData.uploadSuccess,
      hasUploadError: !!viewData.uploadError,
      reviewHistoryCount: reviewHistory.length,
      backendUrl,
      totalProcessingTime: `${totalProcessingTime}s`
    })

    return h.view('home/index', viewData)
  }
}
