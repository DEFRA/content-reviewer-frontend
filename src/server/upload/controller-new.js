import { config } from '../../config/config.js'

const uploadController = {
  /**
   * Show upload form
   */
  async showUploadForm(request, h) {
    return h.view('upload/index', {
      pageTitle: 'Upload Document',
      heading: 'Upload PDF or Word Document'
    })
  },

  /**
   * Handle file upload (render upload page with file input)
   */
  async uploadPage(request, h) {
    return h.view('upload/upload-form', {
      pageTitle: 'Upload Document',
      heading: 'Upload Your Document',
      backendUrl: config.get('backendUrl')
    })
  }
}

export { uploadController }
