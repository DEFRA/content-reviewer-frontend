/**
 * A GDS styled example home page controller.
 * Provided as an example, remove or modify as required.
 */
export const homeController = {
  async handler(request, h) {
    // Get flash messages from session
    const uploadSuccess = request.yar.flash('uploadSuccess')
    const uploadError = request.yar.flash('uploadError')

    // Fetch review history from backend
    let reviewHistory = []
    try {
      // Use hardcoded backend URL for now to avoid config issues
      const backendUrl = 'http://localhost:3001'

      const response = await fetch(`${backendUrl}/api/review-history?limit=20`)

      if (response.ok) {
        const data = await response.json()
        reviewHistory = data.reviews || []
      }
    } catch (error) {
      request.logger.error(
        error,
        'Failed to fetch review history for home page'
      )
      // Continue with empty history - don't break the page
    }

    return h.view('home/index', {
      pageTitle: 'Home',
      heading: 'Home',
      uploadSuccess: uploadSuccess.length > 0 ? uploadSuccess[0] : null,
      uploadError: uploadError.length > 0 ? uploadError[0] : null,
      reviewHistory
    })
  }
}
