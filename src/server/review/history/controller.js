/**
 * Review History Controller
 * Handles displaying list of past reviews
 */

export const reviewHistoryController = {
  /**
   * Show review history page
   */
  async showHistory(request, h) {
    try {
      const config = request.server.app.config
      const backendUrl = config.get('backendUrl')

      // Fetch review history from backend
      const response = await fetch(`${backendUrl}/api/reviews?limit=100`)

      if (!response.ok) {
        throw new Error('Failed to fetch review history')
      }

      const data = await response.json()

      return h.view('review/history/index', {
        pageTitle: 'Review History',
        heading: 'Review History',
        reviews: data.reviews || [],
        count: data.count || 0
      })
    } catch (error) {
      request.logger.error(error, 'Failed to fetch review history')

      return h.view('review/history/index', {
        pageTitle: 'Review History',
        heading: 'Review History',
        reviews: [],
        count: 0,
        error: 'Unable to load review history. Please try again later.'
      })
    }
  },

  /**
   * Delete a review from history
   */
  async deleteReview(request, h) {
    try {
      const { reviewId } = request.params
      const config = request.server.app.config
      const backendUrl = config.get('backendUrl')

      const response = await fetch(`${backendUrl}/api/reviews/${reviewId}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        throw new Error('Failed to delete review')
      }

      // Redirect back to history
      return h.redirect('/review/history')
    } catch (error) {
      request.logger.error(error, 'Failed to delete review')
      return h.redirect('/review/history?error=delete_failed')
    }
  }
}
