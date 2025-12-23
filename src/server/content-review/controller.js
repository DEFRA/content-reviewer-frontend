import { config } from '~/src/config/index.js'

const contentReviewController = {
  handler: (request, h) => {
    return h.view('content-review/views/index', {
      pageTitle: 'Content Review Tool',
      heading: 'Content Review Assistant',
      backendApiUrl: config.get('backendApiUrl'),
      breadcrumbs: [
        {
          text: 'Home',
          href: '/'
        },
        {
          text: 'Content Review Tool'
        }
      ]
    })
  }
}

export { contentReviewController }
