/**
 * Cookies page controller
 * Displays information about cookies used in the service and handles cookie preferences
 */

/**
 * GET handler - Display cookies page
 */
export const cookiesGetController = {
  handler (request, h) {
    // Check if user has analytics cookie preference set
    const cookiePreferences = request.state.cookie_preferences || {}
    const showConfirmation = request.query.saved === 'true'

    return h.view('cookies/index', {
      pageTitle: 'Cookies',
      heading: 'Cookies',
      breadcrumbs: [
        {
          text: 'Home',
          href: '/'
        },
        {
          text: 'Cookies'
        }
      ],
      analyticsCookies: cookiePreferences.analytics ? 'yes' : 'no',
      showConfirmation
    })
  }
}

/**
 * POST handler - Save cookie preferences
 */
const COOKIE_EXPIRY_DAYS = 90 // Defra standard for essential cookies

export const cookiesPostController = {
  handler (request, h) {
    const analytics = request.payload?.analytics === 'yes'

    // Save cookie preferences
    const cookiePreferences = { analytics }

    // Set cookie with preferences (90 days expiry - Defra standard for essential cookies)
    const response = h.redirect('/cookies?saved=true')
    response.state('cookie_preferences', cookiePreferences, {
      ttl: COOKIE_EXPIRY_DAYS * 24 * 60 * 60 * 1000, // 90 days in milliseconds
      isSecure: process.env.NODE_ENV === 'production',
      isHttpOnly: false, // Needs to be accessible by JavaScript for banner logic
      isSameSite: 'Strict',
      path: '/'
    })

    return response
  }
}

// Legacy export for backwards compatibility
export const cookiesController = cookiesGetController
