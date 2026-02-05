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

      // For pagination: if limit > pageSize, use skip/pageSize for efficient backend pagination
      // Otherwise, just fetch the limit amount
      //
      // PAGINATION FLOW (e.g., user selects 50 reviews):
      // - Page 1: limit=25, skip=0  → Backend returns 25 MOST RECENT reviews (1-25)
      // - Page 2: limit=25, skip=25 → Backend returns 25 OLDER reviews (26-50)
      //
      // Backend sorts by most recent first, then applies skip/limit
      // This ensures page 1 always shows the newest content
      let backendEndpoint
      let fetchLimit

      if (limit > pageSize) {
        // Paginated request: fetch only the current page's data (25 items)
        // Backend will sort by most recent, skip N items, return 25 items
        fetchLimit = pageSize
        backendEndpoint = `${backendUrl}/api/reviews?limit=${fetchLimit}&skip=${skip}`
      } else {
        // Non-paginated request: fetch all requested items (5, 10, etc.)
        fetchLimit = limit
        backendEndpoint = `${backendUrl}/api/reviews?limit=${fetchLimit}`
      }

      logger.info('Initiating review history fetch for home page', {
        endpoint: backendEndpoint,
        currentPage,
        pageSize,
        skip,
        fetchLimit,
        requestedLimit: limit,
        isPaginated: limit > pageSize
      })

      const response = await fetch(backendEndpoint)

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

        // Calculate total reviews and pages based on user's selected limit
        // For paginated views (limit > 25): totalReviews = user's limit (50, 100, etc.)
        // For non-paginated views (limit <= 25): totalReviews = actual count from backend
        if (limit > pageSize) {
          // User selected 50/100 reviews - use that as total, not system-wide count
          totalReviews = Math.min(
            limit,
            data.pagination?.total || data.total || limit
          )
          totalPages = Math.ceil(totalReviews / pageSize)

          console.log('[HOME-CONTROLLER] Paginated view calculation:', {
            userSelectedLimit: limit,
            backendTotal: data.pagination?.total || data.total,
            calculatedTotalReviews: totalReviews,
            calculatedTotalPages: totalPages,
            pageSize,
            example:
              limit === 100
                ? 'Page 1: 1-25, Page 2: 26-50, Page 3: 51-75, Page 4: 76-100'
                : limit === 50
                  ? 'Page 1: 1-25, Page 2: 26-50'
                  : `${totalPages} page(s) with ${pageSize} reviews each`
          })
        } else {
          // Non-paginated view - use actual count
          totalReviews =
            data.pagination?.total ||
            data.total ||
            data.count ||
            normalized.length ||
            0
          totalPages = 1 // No pagination for limits <= 25
        }

        // Backend already returned the correct page's data when limit > pageSize
        // No client-side slicing needed - just use what backend returned
        if (limit > pageSize) {
          const reviewRangeStart = skip + 1
          const reviewRangeEnd = skip + normalized.length
          const pageDescription =
            limit === 100
              ? `Page ${currentPage} of 4 (100 reviews total, 25 per page)`
              : limit === 50
                ? `Page ${currentPage} of 2 (50 reviews total, 25 per page)`
                : `Page ${currentPage} of ${totalPages} (${totalReviews} reviews total, ${pageSize} per page)`

          console.log(
            '[HOME-CONTROLLER] Using backend-paginated data (no client-side slicing):',
            {
              userSelectedLimit: limit,
              pageSize,
              currentPage,
              totalReviews,
              totalPages,
              returnedItems: normalized.length,
              expectedItems: Math.min(pageSize, totalReviews - skip),
              reviewRange: `${reviewRangeStart}-${reviewRangeEnd}`,
              pageDescription
            }
          )

          // Backend already sent skip+limit items, use them directly
          // These are sorted by most recent first
          reviewHistory = normalized

          console.log('[HOME-CONTROLLER] Backend-paginated results:', {
            resultLength: reviewHistory.length,
            reviewRange: `Reviews ${skip + 1} to ${skip + reviewHistory.length}`,
            firstReview: reviewHistory[0]?.filename,
            lastReview: reviewHistory[reviewHistory.length - 1]?.filename,
            sortOrder: 'Most recent first (page 1 = newest, page 2 = older)'
          })
        } else {
          // Show all returned records if limit <= 25 (no pagination needed)
          reviewHistory = normalized
        }

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
