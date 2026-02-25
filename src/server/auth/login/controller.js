export const loginController = {
  handler: (request, h) => {
    // If already authenticated, redirect to home
    if (request.auth.isAuthenticated) {
      return h.redirect('/')
    }
    return h.view('auth/login/index', {
      pageTitle: 'Sign in - Content Review Tool - GOV.UK',
      heading: 'Content Review Assistant',
      serviceName: 'Content Review Tool'
    })
  }
}
