export const loginController = {
  handler: (request, h) => {
    // If already authenticated, redirect to home
    if (request.auth.isAuthenticated) {
      return h.redirect('/')
    }
    // Map error codes to user-friendly messages
    const errorMessages = {
      auth_failed: 'Sign in failed. Please try again.',
      invalid_state: 'Invalid login state. Please try again.',
      unauthorized_tenant:
        'Your account is not authorized to access this service. Please contact your administrator.'
    }
    const errorCode = request.query.error
    const errorMessage = errorCode
      ? errorMessages[errorCode] ||
        'An error occurred during sign in. Please try again.'
      : null
    return h.view('auth/login/index', {
      pageTitle: 'Sign in – Content Review Tool – GOV.UK',
      heading: 'Sign in',
      serviceName: 'Content Review Tool',
      errorMessage
    })
  }
}
