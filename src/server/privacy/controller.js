/**
 * Privacy page controller
 * Displays privacy notice for the service
 */

const PRIVACY_NOTICE_TEXT = 'Privacy notice'

export const privacyController = {
  handler(_request, h) {
    return h.view('privacy/index', {
      pageTitle: PRIVACY_NOTICE_TEXT,
      heading: PRIVACY_NOTICE_TEXT,
      breadcrumbs: [
        {
          text: 'Home',
          href: '/'
        },
        {
          text: PRIVACY_NOTICE_TEXT
        }
      ]
    })
  }
}
