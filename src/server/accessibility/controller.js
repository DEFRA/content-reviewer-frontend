/**
 * Accessibility page controller
 * Displays accessibility statement for the service
 */
export const accessibilityController = {
  handler(_request, h) {
    return h.view('accessibility/index', {
      pageTitle: 'Accessibility statement',
      heading: 'Accessibility statement',
      breadcrumbs: [
        {
          text: 'Home',
          href: '/'
        },
        {
          text: 'Accessibility statement'
        }
      ]
    })
  }
}
