/**
 * Privacy page controller
 * Displays privacy notice for the service
 */
export const privacyController = {
  handler(_request, h) {
    return h.view('privacy/index', {
      pageTitle: 'Privacy notice',
      heading: 'Privacy notice',
      breadcrumbs: [
        {
          text: 'Home',
          href: '/'
        },
        {
          text: 'Privacy notice'
        }
      ]
    })
  }
}
