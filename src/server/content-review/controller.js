import { config } from '../../config/config.js'

const contentReviewController = {
  handler: (request, h) => {
    return h.view('content-review/views/index', {
      pageTitle: 'Content Review Tool',
      heading: 'Content Review Assistant',
      backendApiUrl: config.get('backendApiUrl'),
      breadcrumbs: []
    })
  }
}

export { contentReviewController }
