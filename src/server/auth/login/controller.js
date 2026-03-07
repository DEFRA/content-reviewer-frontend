export const loginController = {
  handler: (request, h) => {
    // If already authenticated, redirect to home
    if (request.auth.isAuthenticated) {
      return h.redirect('/')
    }
    // Map error codes to user-friendly messages
    const errorMessages = {
      auth_failed:
        'Sign in failed. If you are not part of the Defra organization, you can continue using the tool without signing in. Your review history will be saved for this session.',
      invalid_state:
        'Invalid login state. Please try again or continue without signing in.',
      unauthorized_tenant:
        'Your account is not authorized to access this service. You can continue using the tool without signing in. Your review history will be saved for this session.'
      // Add more mappings as needed
    }
    const errorCode = request.query.error
    const errorMessage = errorCode
      ? errorMessages[errorCode] ||
        'An error occurred during sign in. You can continue using the tool without signing in. Your review history will be saved for this session.'
      : null
    return h.view('auth/login/index', {
      pageTitle: 'Sign in - Content Review Tool - GOV.UK',
      heading: 'Content Review Assistant',
      serviceName: 'Content Review Tool',
      errorMessage
    })
  }
}
