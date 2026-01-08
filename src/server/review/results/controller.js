import { getReviewResults } from './data-service.js'

export const resultsController = {
  handler: (request, h) => {
    const { id } = request.params
    const reviewResults = getReviewResults(id)

    return h.view('review/results/index', {
      pageTitle: 'Review Results',
      heading: 'Content Review Results',
      results: reviewResults
    })
  }
}
