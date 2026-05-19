import { randomUUID } from 'node:crypto'
import { config } from '../../config/config.js'
import {
  initiateUpload,
  getUploadStatus
} from '../common/helpers/cdp-uploader-client.js'

// HTTP Status Codes
const HTTP_STATUS_OK = 200
const HTTP_STATUS_SERVER_ERROR = 500

const uploadController = {
  /**
   * Show upload form
   * @param {object} _request - Hapi request object (unused)
   * @param {object} h - Hapi response toolkit
   * @returns {object} View response
   */
  async showUploadForm(_request, h) {
    return h.view('upload/index', {
      pageTitle: 'Upload Document',
      heading: 'Upload PDF or Word Document'
    })
  },

  /**
   * Initiate upload with CDP Uploader and return the upload URL to the browser.
   * The browser will then submit the file directly to the CDP Uploader via a
   * hidden form POST (POST /upload-and-scan/{uploadId}), which scans the file
   * and stores it in S3. Once the status-poller detects the scan is complete it
   * explicitly calls /upload/trigger-review with the S3 details (step c).
   * No automatic webhook callback is registered — the frontend orchestrates the
   * backend processing after polling confirms the file is ready.
   */
  async initiateUpload(request, h) {
    try {
      const reviewId = randomUUID()
      const host = `${request.server.info.protocol}://${request.info.host}`

      // CDP Uploader redirects the browser here after the upload is complete.
      // reviewId is embedded so the status-poller page knows which review to track.
      const redirectUrl = `${host}/upload/status-poller?reviewId=${encodeURIComponent(reviewId)}`

      const userId = request.yar?.id || 'unknown'
      // No callbackUrl — the frontend status-poller will explicitly call the
      // backend with the S3 URL once CDP Uploader confirms the scan is ready.
      const uploadSession = await initiateUpload({
        redirect: redirectUrl,
        metadata: { reviewId, userId }
      })

      // Persist both IDs so the status-poller controller can look them up from session
      request.yar.set('currentUploadId', uploadSession.uploadId)
      request.yar.set('currentReviewId', reviewId)

      // CDP Uploader returns a relative uploadUrl (e.g. /upload-and-scan/{uploadId}).
      // Resolve it to an absolute URL so the browser form action targets the
      // correct CDP Uploader service rather than our own server.
      const cdpUploaderBaseUrl = config.get('cdpUploader.url')
      const absoluteUploadUrl = new URL(
        uploadSession.uploadUrl,
        cdpUploaderBaseUrl
      ).href

      return h.response({ uploadUrl: absoluteUploadUrl }).code(HTTP_STATUS_OK)
    } catch (error) {
      request.logger.error(error, 'Failed to initiate upload')
      return h
        .response({ message: 'Failed to initiate upload. Please try again.' })
        .code(HTTP_STATUS_SERVER_ERROR)
    }
  },

  /**
   * Step c: Called by the status-poller page once CDP Uploader confirms the
   * scanned file is ready in S3. Fetches the full scan result (including S3 key)
   * from CDP Uploader and forwards it to the backend /upload-callback endpoint,
   * which extracts text, creates the canonical document, and queues the SQS job
   * that triggers the Bedrock AI review.
   */
  async triggerReview(request, h) {
    try {
      const { uploadId, reviewId } = request.payload
      const backendUrl = config.get('backendUrl')
      const userId = request.yar?.id || 'unknown'

      // Get the full scan result from CDP Uploader — includes S3 key, contentType, etc.
      const status = await getUploadStatus(uploadId)

      // Forward to backend in the CDP Uploader callback format so the existing
      // handler can extract text from S3, create the canonical document, and
      // queue the review job in SQS.
      const callbackPayload = {
        uploadStatus: status.uploadStatus,
        uploadId,
        metadata: { reviewId, userId },
        form: status.form,
        numberOfRejectedFiles: status.numberOfRejectedFiles
      }

      const response = await fetch(`${backendUrl}/upload-callback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(callbackPayload)
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(
          errorData.message || `Backend processing failed: ${response.status}`
        )
      }

      request.logger.info(
        { reviewId, uploadId },
        'Review triggered successfully'
      )
      return h.response({ reviewId }).code(HTTP_STATUS_OK)
    } catch (error) {
      request.logger.error(error, 'Failed to trigger review')
      return h
        .response({ error: 'Failed to trigger review. Please try again.' })
        .code(HTTP_STATUS_SERVER_ERROR)
    }
  },

  /**
   * Landing page after CDP Uploader redirects the browser back.
   * CDP Uploader appends ?reviewId=... to the redirect URL set during /initiate.
   * The uploadId is retrieved from the session (set during /initiate).
   */
  async statusPoller(request, h) {
    // reviewId comes from the CDP Uploader redirect query param
    const reviewId =
      request.query.reviewId || request.yar.get('currentReviewId')
    const uploadId = request.yar.get('currentUploadId')

    if (!reviewId && !uploadId) {
      return h.redirect('/')
    }

    // Persist reviewId in session in case the user refreshes the page
    if (reviewId) {
      request.yar.set('currentReviewId', reviewId)
    }

    return h.view('upload/status-poller', {
      pageTitle: 'Processing Upload',
      heading: 'Processing Your Document',
      uploadId: uploadId || '',
      reviewId: reviewId || ''
    })
  },

  /**
   * API endpoint to get upload status
   * @param {object} request - Hapi request object
   * @param {object} h - Hapi response toolkit
   * @returns {object} Response with status
   */
  async getStatus(request, h) {
    try {
      const { uploadId } = request.params

      const status = await getUploadStatus(uploadId)

      return h.response(status).code(HTTP_STATUS_OK)
    } catch (error) {
      request.logger.error(error, 'Failed to get upload status')
      return h
        .response({ error: 'Failed to get upload status' })
        .code(HTTP_STATUS_SERVER_ERROR)
    }
  }
}

export { uploadController }
