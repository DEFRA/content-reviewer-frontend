/**
 * About page controller
 * Displays information about the Content Review Tool
 */
export const aboutController = {
  handler(_request, h) {
    return h.view('about/index', {
      pageTitle: 'Content Review Assistant',
      heading: 'Content Review Assistant'
    })
  }
}
