export const loginController = {
  handler: (request, h) => {
    // If already authenticated, redirect to home
    if (request.auth.isAuthenticated) {
      return h.redirect('/')
    }
    // Map error codes to user-friendly messages
    const errorMessages = {
      auth_failed:
        'Authentication failed. Please try again or contact support.',
      invalid_state: 'Invalid login state. Please try again.'
      // Add more mappings as needed
    }
    const errorCode = request.query.error
    const errorMessage = errorCode
      ? errorMessages[errorCode] ||
        'An unknown error occurred. Please try again.'
      : null
    return h.view('auth/login/index', {
      pageTitle: 'Sign in - Content Review Tool - GOV.UK',
      heading: 'Content Review Assistant',
      serviceName: 'Content Review Tool',
      errorMessage
    })
  }
}
