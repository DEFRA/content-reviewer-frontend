/**
 * A GDS styled example home page controller.
 * Provided as an example, remove or modify as required.
 */
import { createLogger } from '../common/helpers/logging/logger.js'

const logger = createLogger()

export const homeController = {
  async handler(request, h) {
    const startTime = Date.now()
    logger.info('Home page request started')
    console.log('[HOME-CONTROLLER] Processing home page request')

    // Get flash messages from session
    const uploadSuccess = request.yar.flash('uploadSuccess')
    const uploadError = request.yar.flash('uploadError')

    logger.info('Flash messages retrieved', {
      hasUploadSuccess: uploadSuccess.length > 0,
      hasUploadError: uploadError.length > 0
    })
    console.log('[HOME-CONTROLLER] Flash messages:', {
      uploadSuccess: uploadSuccess.length > 0,
      uploadError: uploadError.length > 0
    })

    // Get backend URL from config
    const config = request.server.app.config
    const backendUrl = config.get('backendUrl')

    logger.info('Configuration retrieved', { backendUrl })
    console.log('[HOME-CONTROLLER] Backend URL:', backendUrl)

    // Fetch review history from backend
    let reviewHistory = []
    try {
      const backendRequestStart = Date.now()
      console.log('[HOME-CONTROLLER] Fetching review history from backend')
      logger.info('Initiating review history fetch for home page', {
        endpoint: `${backendUrl}/api/reviews?limit=20`
      })

      const response = await fetch(`${backendUrl}/api/reviews?limit=20`)

      const backendRequestEnd = Date.now()
      const backendRequestTime =
        (backendRequestEnd - backendRequestStart) / 1000

      logger.info('Review history fetch response received', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
        requestTime: `${backendRequestTime}s`
      })
      console.log('[HOME-CONTROLLER] Review history fetch response:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok
      })

      if (response.ok) {
        const data = await response.json()
        reviewHistory = data.reviews || []
        logger.info('Review history retrieved successfully', {
          count: reviewHistory.length,
          totalFromResponse: data.total || data.count || 0,
          requestTime: `${backendRequestTime}s`
        })
        console.log('[HOME-CONTROLLER] Review history fetched successfully:', {
          count: reviewHistory.length,
          totalFromResponse: data.total || data.count || 0
        })
      } else {
        logger.warn('Review history fetch failed with non-ok status', {
          status: response.status,
          requestTime: `${backendRequestTime}s`
        })
        console.warn(
          '[HOME-CONTROLLER] Review history fetch failed with status:',
          response.status
        )
      }
    } catch (error) {
      logger.error('Failed to fetch review history for home page', {
        message: error.message,
        stack: error.stack,
        backendUrl
      })
      console.error('[HOME-CONTROLLER] Failed to fetch review history:', {
        message: error.message,
        stack: error.stack
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
      backendUrl // Pass to template for client-side use
    }

    const totalProcessingTime = (Date.now() - startTime) / 1000

    logger.info('Home page rendering completed', {
      hasUploadSuccess: !!viewData.uploadSuccess,
      hasUploadError: !!viewData.uploadError,
      reviewHistoryCount: reviewHistory.length,
      backendUrl,
      totalProcessingTime: `${totalProcessingTime}s`
    })
    console.log('[HOME-CONTROLLER] Rendering view with data:', {
      hasUploadSuccess: !!viewData.uploadSuccess,
      hasUploadError: !!viewData.uploadError,
      reviewHistoryCount: reviewHistory.length,
      backendUrl
    })

    return h.view('home/index', viewData)
  }
}
