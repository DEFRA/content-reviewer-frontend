/**
 * Home page controller
 * Handles displaying the main page with review submission and history
 */
import { createLogger } from '../common/helpers/logging/logger.js'

const logger = createLogger()

/**
 * Normalize review data to ensure consistent structure
 */
const normalizeReviewData = (reviews) => {
  if (!Array.isArray(reviews)) {
    return []
  }
  return reviews.map((review) => ({
    id: review.id || review.reviewId,
    reviewId: review.reviewId || review.id,
    ...review
  }))
}

/**
 * Get pagination parameters from request
 */
const getPaginationParams = (request) => {
  const limit = Number.parseInt(request.query.limit) || 10
  const pageSize = 25
  const currentPage = Number.parseInt(request.query.page) || 1
  const skip = (currentPage - 1) * pageSize
  return { limit, pageSize, currentPage, skip }
}

/**
 * Determine backend endpoint based on pagination needs
 */
const getBackendEndpoint = (backendUrl, limit, pageSize, skip) => {
  let fetchLimit
  let endpoint

  if (limit > pageSize) {
    fetchLimit = pageSize
    endpoint = `${backendUrl}/api/reviews?limit=${fetchLimit}&skip=${skip}`
  } else {
    fetchLimit = limit
    endpoint = `${backendUrl}/api/reviews?limit=${fetchLimit}`
  }

  return { backendEndpoint: endpoint, fetchLimit }
}

/**
 * Calculate total reviews and pages based on limit and response data
 */
const calculatePagination = (limit, pageSize, data, normalizedLength) => {
  let totalReviews
  let totalPages

  if (limit > pageSize) {
    totalReviews = Math.min(
      limit,
      data.pagination?.total || data.total || limit
    )
    totalPages = Math.ceil(totalReviews / pageSize)
  } else {
    totalReviews =
      data.pagination?.total ||
      data.total ||
      data.count ||
      normalizedLength ||
      0
    totalPages = 1
  }

  return { totalReviews, totalPages }
}

/**
 * Process backend response and normalize data
 */
const processBackendResponse = async (backendEndpoint) => {
  const startTime = Date.now()
  const response = await fetch(backendEndpoint)
  const data = await response.json()
  const backendRequestTime = Date.now() - startTime

  const reviews = data.reviews || data.data || data || []
  const normalized = normalizeReviewData(reviews)
  const missingId = normalized.some((review) => !review.id && !review.reviewId)

  return { data, normalized, missingId, backendRequestTime }
}

/**
 * Log review results for debugging
 */
const logReviewResults = (
  reviewHistory,
  {
    totalReviews,
    totalPages,
    currentPage,
    pageSize,
    backendRequestTime,
    missingId
  }
) => {
  logger.info(
    `Review history fetched - count: ${reviewHistory.length}, total: ${totalReviews}, pages: ${totalPages}, currentPage: ${currentPage}, pageSize: ${pageSize}, backendRequestTime: ${backendRequestTime}ms, missingId: ${missingId}`
  )
}

/**
 * Fetch review history from backend
 */
const fetchReviewHistory = async (
  backendUrl,
  limit,
  pageSize,
  currentPage,
  skip
) => {
  let reviewHistory = []
  let totalReviews = 0
  let totalPages = 1

  try {
    const { backendEndpoint } = getBackendEndpoint(
      backendUrl,
      limit,
      pageSize,
      skip
    )

    const { data, normalized, missingId, backendRequestTime } =
      await processBackendResponse(backendEndpoint)

    reviewHistory = normalized
    const pagination = calculatePagination(
      limit,
      pageSize,
      data,
      normalized.length
    )
    totalReviews = pagination.totalReviews
    totalPages = pagination.totalPages

    logReviewResults(reviewHistory, {
      totalReviews,
      totalPages,
      currentPage,
      pageSize,
      backendRequestTime,
      missingId
    })
  } catch (error) {
    logger.error(
      `Failed to fetch review history for home page - message: ${error.message}, backendUrl: ${backendUrl}`,
      {
        stack: error.stack
      }
    )
  }

  return { reviewHistory, totalReviews, totalPages }
}

/**
 * Home page controller handler
 */
export const homeController = {
  handler: async (request, h) => {
    const uploadSuccess = request.yar.flash('uploadSuccess')
    const uploadError = request.yar.flash('uploadError')
    const config = request.server.app.config
    const backendUrl = config.get('backendUrl')

<<<<<<< HEAD
    logger.info('Configuration retrieved', { backendUrl })
    console.log('[HOME-CONTROLLER] Backend URL:', backendUrl)

    // Fetch review history from backend
    // Default to 5, but support limit query param for future use
    const limit = parseInt(request.query.limit) || 5
    let reviewHistory = []
    try {
      const backendRequestStart = Date.now()
      console.log('[HOME-CONTROLLER] Fetching review history from backend')
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
      console.log('[HOME-CONTROLLER] Review history fetch response:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok
      })

      if (response.ok) {
        const data = await response.json()

        console.log('Review history on home page:', data)
        logger.info('Response from backend for review history', {
          reviews: data.reviews
        })
        console.log(
          '[HOME-CONTROLLER] Response ID from backend for review history',
          data.reviews.id
        )

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
        console.log('[HOME-CONTROLLER] Review history fetched successfully:', {
          count: reviewHistory.length,
          totalFromResponse: data.total || data.count || 0,
          missingIdCount: missingId.length
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
=======
    const { limit, pageSize, currentPage, skip } = getPaginationParams(request)
    const { reviewHistory, totalReviews, totalPages } =
      await fetchReviewHistory(backendUrl, limit, pageSize, currentPage, skip)
>>>>>>> ff60217ad53ed6a151cd16f021dd1bc0d6733352

    const viewData = {
      pageTitle: 'Home',
      heading: 'Home',
      uploadSuccess: uploadSuccess.length > 0 ? uploadSuccess[0] : null,
      uploadError: uploadError.length > 0 ? uploadError[0] : null,
      reviewHistory,
      backendUrl,
      contentReviewMaxCharLength: config.get('contentReview.maxCharLength'),
      cacheBuster: Date.now(),
      currentLimit: limit,
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
