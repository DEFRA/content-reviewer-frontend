import { randomUUID } from 'node:crypto'
import { config } from '../../config/config.js'
import { initiateUpload } from '../common/helpers/cdp-uploader-client.js'

// HTTP Status Codes
const HTTP_STATUS_OK = 200
const HTTP_STATUS_SERVER_ERROR = 500

const uploadController = {
  /**
   * Show upload form
   */
  async showUploadForm(_request, h) {
    return h.view('upload/index', {
      pageTitle: 'Upload Document',
      heading: 'Upload PDF or Word Document'
    })
  },

  /**
   * Initiate upload with CDP Uploader and return the upload URL + reviewId to
   * the browser. The browser submits the file directly to CDP Uploader via a
   * hidden form POST. CDP Uploader virus-scans the file, calls the backend
   * /upload-callback automatically (callbackUrl), then redirects the browser
   * back to the homepage. No frontend status-poller step is needed.
   */
  async initiateUpload(request, h) {
    try {
      const reviewId = randomUUID()
      const backendUrl = config.get('backendUrl')

      // CDP Uploader calls this server-to-server after the virus scan completes.
      // The backend extracts text from S3, creates the canonical document, and
      // queues the SQS job that triggers the Bedrock AI review.
      const callbackUrl = `${backendUrl}/upload-callback`

      const userId = request.yar?.id || 'unknown'
      const uploadSession = await initiateUpload({
        // Relative path redirect — matches the PAFS portal pattern used by other
        // DEFRA services. CDP Uploader resolves it back to our service in production
        // (same-host routing). Locally, CDP Uploader dev mode converts it via Referer.
        redirect: `/upload/complete?reviewId=${encodeURIComponent(reviewId)}`,
        callback: callbackUrl,
        metadata: { reviewId, userId }
      })

      const cdpUploaderBaseUrl = config.get('cdpUploader.url')
      const absoluteUploadUrl = new URL(
        uploadSession.uploadUrl,
        cdpUploaderBaseUrl
      ).href

      // Return reviewId so the browser can immediately add a pending history entry
      return h
        .response({ uploadUrl: absoluteUploadUrl, reviewId })
        .code(HTTP_STATUS_OK)
    } catch (error) {
      request.logger.error(error, 'Failed to initiate upload')
      return h
        .response({ message: 'Failed to initiate upload. Please try again.' })
        .code(HTTP_STATUS_SERVER_ERROR)
    }
  }
}

export { uploadController }
