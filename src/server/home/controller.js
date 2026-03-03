/**
 * Home page controller
 * Handles displaying the main page with review submission and history
 */
import { createLogger } from '../common/helpers/logging/logger.js'
import { getUserIdentifier } from '../common/helpers/get-user-identifier.js'

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
const DEFAULT_LIMIT = 5

const getPaginationParams = (request) => {
  const limit = Number.parseInt(request.query.limit) || DEFAULT_LIMIT
  const pageSize = 25
  const currentPage = Number.parseInt(request.query.page) || 1
  const skip = (currentPage - 1) * pageSize
  return { limit, pageSize, currentPage, skip }
}

/**
 * Determine backend endpoint based on pagination needs.
 * Includes userId query param to scope results to the authenticated user.
 */
const getBackendEndpoint = (backendUrl, limit, pageSize, skip, userId) => {
  let fetchLimit
  const params = new URLSearchParams()

  if (limit > pageSize) {
    fetchLimit = pageSize
    params.set('limit', fetchLimit)
    params.set('skip', skip)
  } else {
    fetchLimit = limit
    params.set('limit', fetchLimit)
  }

  if (userId) {
    params.set('userId', userId)
  }

  return {
    backendEndpoint: `${backendUrl}/api/reviews?${params.toString()}`,
    fetchLimit
  }
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
 * Fetch review history from backend, scoped to the authenticated user.
 */
const fetchReviewHistory = async (
  backendUrl,
  limit,
  pageSize,
  currentPage,
  skip,
  userId
) => {
  let reviewHistory = []
  let totalReviews = 0
  let totalPages = 1

  try {
    const { backendEndpoint } = getBackendEndpoint(
      backendUrl,
      limit,
      pageSize,
      skip,
      userId
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

    // Use session ID for anonymous users to ensure consistent review history per-session
    const userId = getUserIdentifier(request)

    const { limit, pageSize, currentPage, skip } = getPaginationParams(request)
    const { reviewHistory, totalReviews, totalPages } =
      await fetchReviewHistory(
        backendUrl,
        limit,
        pageSize,
        currentPage,
        skip,
        userId
      )

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
