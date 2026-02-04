/**
 * Home page controller
 * Handles displaying the main page with review submission and history
 */
import { createLogger } from '../common/helpers/logging/logger.js'

const logger = createLogger()

export const homeController = {
  async handler(request, h) {
    // Get flash messages from session
    const uploadSuccess = request.yar.flash('uploadSuccess')
    const uploadError = request.yar.flash('uploadError')

    // Get backend URL from config
    const config = request.server.app.config
    const backendUrl = config.get('backendUrl')

    // Fetch review history from backend
    // Default to 5, but support limit query param for future use
    const limit = parseInt(request.query.limit) || 5
    const pageSize = 25 // Number of items per page
    const currentPage = parseInt(request.query.page) || 1
    const skip = (currentPage - 1) * pageSize

    let reviewHistory = []
    let totalReviews = 0
    let totalPages = 0

    try {
      const backendRequestStart = Date.now()
      console.log('[HOME-CONTROLLER] Fetching review history from backend')
      logger.info('Initiating review history fetch for home page', {
        endpoint: `${backendUrl}/api/reviews?limit=${limit}&skip=${skip}&pageSize=${pageSize}`,
        currentPage,
        pageSize,
        skip
      })

      const response = await fetch(`${backendUrl}/api/reviews?limit=${limit}`)

      const backendRequestEnd = Date.now()
      const backendRequestTime =
        (backendRequestEnd - backendRequestStart) / 1000

      if (response.ok) {
        const data = await response.json()

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

        // Calculate total pages - use pagination.total from backend if available
        totalReviews =
          data.pagination?.total ||
          data.total ||
          data.count ||
          normalized.length ||
          0
        totalPages = Math.ceil(totalReviews / pageSize)

        // Slice reviews to show only the current page
        const pageStartIndex = (currentPage - 1) * pageSize
        const pageEndIndex = pageStartIndex + pageSize
        reviewHistory = normalized.slice(pageStartIndex, pageEndIndex)

        logger.info('Review history retrieved successfully', {
          count: reviewHistory.length,
          totalFromResponse: data.total || data.count || 0,
          totalReviews,
          totalPages,
          currentPage,
          pageSize,
          requestTime: `${backendRequestTime}s`,
          missingIdCount: missingId.length,
          reviewid: data.reviews.id
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
      }
    } catch (error) {
      logger.error(
        `Failed to fetch review history for home page - message: ${error.message}, backendUrl: ${backendUrl}`,
        {
          stack: error.stack
        }
      )
    }

    const viewData = {
      pageTitle: 'Home',
      heading: 'Home',
      uploadSuccess: uploadSuccess.length > 0 ? uploadSuccess[0] : null,
      uploadError: uploadError.length > 0 ? uploadError[0] : null,
      reviewHistory,
      backendUrl, // Pass to template for client-side use
      cacheBuster: Date.now(), // Add cacheBuster for template
      currentLimit: limit, // Pass the current limit to template
      pagination: {
        currentPage,
        pageSize,
        totalReviews,
        totalPages,
        hasNextPage: currentPage < totalPages,
        hasPreviousPage: currentPage > 1
      }
    }

    return h.view('home/index', viewData)
  }
}
