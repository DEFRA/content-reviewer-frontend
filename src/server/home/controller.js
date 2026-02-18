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

    const { limit, pageSize, currentPage, skip } = getPaginationParams(request)
    const { reviewHistory, totalPages } = await fetchReviewHistory(
      backendUrl,
      limit,
      pageSize,
      currentPage,
      skip
    )

    const viewData = {
      pageTitle: 'Home',
      uploadSuccess: uploadSuccess[0],
      uploadError: uploadError[0],
      reviews: reviewHistory,
      limit,
      currentPage,
      totalPages,
      hasNextPage: currentPage < totalPages,
      hasPreviousPage: currentPage > 1
    }

    return h.view('home/index', viewData)
  }
}
