/**
 * Accessibility page controller
 * Displays accessibility statement for the service
 */
const ACCESSIBILITY_STATEMENT = 'Accessibility statement'

export const accessibilityController = {
  handler (_request, h) {
    return h.view('accessibility/index', {
      pageTitle: ACCESSIBILITY_STATEMENT,
      heading: ACCESSIBILITY_STATEMENT,
      breadcrumbs: [
        {
          text: 'Home',
          href: '/'
        },
        {
          text: ACCESSIBILITY_STATEMENT
        }
      ]
    })
  }
}
