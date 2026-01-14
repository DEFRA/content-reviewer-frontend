import { getReviewResults } from '../results/data-service.js'

export const debugController = {
  /**
   * Show processing workflow for debugging (backend users only)
   */
  handler: (request, h) => {
    const { id } = request.params
    const results = getReviewResults(id)

    return h.view('review/debug/index', {
      pageTitle: 'Debug - Processing Workflow',
      heading: 'Processing Workflow (Debug View)',
      results
    })
  }
}
