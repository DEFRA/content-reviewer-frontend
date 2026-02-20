import {
  initiateUpload,
  getUploadStatus
} from '../common/helpers/cdp-uploader-client.js'

// HTTP Status Codes
const HTTP_STATUS_OK = 200
const HTTP_STATUS_SERVER_ERROR = 500

// Upload Status Values
const UPLOAD_STATUS_READY = 'ready'
const REJECTED_FILES_THRESHOLD = 0

// File Details Keys
const FILE_STATUS_PENDING = 'Uploaded (Review pending)'

/**
 * Create file details object for view
 * @param {object} fileDetails - Raw file details
 * @returns {object} Formatted file details
 */
function createFileDetailsForView (fileDetails) {
  return {
    filename: fileDetails.filename,
    contentLength: fileDetails.contentLength,
    detectedContentType: fileDetails.detectedContentType,
    fileId: fileDetails.fileId,
    s3Bucket: fileDetails.s3Bucket,
    s3Key: fileDetails.s3Key,
    fileStatus: FILE_STATUS_PENDING
  }
}

const uploadController = {
  /**
   * Show upload form
   * @param {object} _request - Hapi request object (unused)
   * @param {object} h - Hapi response toolkit
   * @returns {object} View response
   */
  async showUploadForm (_request, h) {
    return h.view('upload/index', {
      pageTitle: 'Upload Document',
      heading: 'Upload PDF or Word Document'
    })
  },

  /**
   * Initiate upload and redirect to CDP uploader
   */
  async initiateUpload (request, h) {
    try {
      const host = `${request.server.info.protocol}://${request.info.host}`
      const redirectUrl = `${host}/upload/status-poller`
      const callbackUrl = `${host}/upload/callback`

      // Minimal process log for visibility
      console.log('[UPLOAD-CONTROLLER] Initiating upload')

      // Get metadata from form if any
      const metadata = {
        userId: request.yar?.id || 'anonymous',
        timestamp: new Date().toISOString()
      }

      const uploadSession = await initiateUpload({
        redirect: redirectUrl,
        callback: callbackUrl,
        metadata
      })

      // Store uploadId in session
      request.yar.set('currentUploadId', uploadSession.uploadId)

      // Redirect to CDP uploader upload page
      return h.redirect(uploadSession.uploadUrl)
    } catch (error) {
      console.error('UPLOAD INITIATION FAILED:', error)
      request.logger.error(error, 'Failed to initiate upload')
      return h.view('upload/index', {
        pageTitle: 'Upload Document',
        heading: 'Upload PDF or Word Document',
        errorMessage: 'Failed to initiate upload. Please try again.'
      })
    }
  },

  /**
   * Handle redirect from CDP uploader and poll for status
   */
  async statusPoller (request, h) {
    const uploadId = request.yar.get('currentUploadId')

    if (!uploadId) {
      return h.redirect('/upload')
    }

    return h.view('upload/status-poller', {
      pageTitle: 'Processing Upload',
      heading: 'Processing Your Document',
      uploadId
    })
  },

  /**
   * API endpoint to get upload status
   * @param {object} request - Hapi request object
   * @param {object} h - Hapi response toolkit
   * @returns {object} Response with status
   */
  async getStatus (request, h) {
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
  },

  /**
   * Initiate AI review in backend
   * @param {object} fileDetails - File details from upload
   * @param {string} backendUrl - Backend API URL
   * @returns {Promise<object>} Review response data
   */
  async initiateAiReview (fileDetails, backendUrl) {
    const reviewPayload = {
      bucket: fileDetails.s3Bucket,
      key: fileDetails.s3Key,
      filename: fileDetails.filename,
      contentType: fileDetails.detectedContentType,
      size: fileDetails.contentLength
    }

    const reviewResponse = await fetch(`${backendUrl}/api/upload`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(reviewPayload)
    })

    if (!reviewResponse.ok) {
      throw new Error(`Backend review failed: ${reviewResponse.status}`)
    }

    return reviewResponse.json()
  },

  /**
   * Handle successful upload with AI review
   * @param {object} request - Hapi request object
   * @param {object} h - Hapi response toolkit
   * @param {object} fileDetails - File details from upload
   * @param {string} backendUrl - Backend API URL
   * @returns {Promise<object>} Redirect or view response
   */
  async handleSuccessfulUpload (request, h, fileDetails, backendUrl) {
    try {
      const reviewData = await this.initiateAiReview(fileDetails, backendUrl)
      console.log(
        '[UPLOAD-CONTROLLER] AI review initiated:',
        reviewData.reviewId
      )

      const reviewId = reviewData.reviewId

      // Store review ID in session
      request.yar.set('currentReviewId', reviewId)
      request.yar.set('hasUploadSuccess', true)
      request.yar.flash(
        'uploadSuccess',
        `File "${fileDetails.filename}" uploaded successfully and AI review initiated.`
      )

      return h.redirect(`/review/status-poller/${reviewId}`)
    } catch (error) {
      console.error('Backend request failed:', error.message)
      request.logger.error(error, 'Error triggering AI review')

      // Still set success flag since file uploaded successfully to S3
      request.yar.set('hasUploadSuccess', true)
      request.yar.flash(
        'uploadSuccess',
        `File "${fileDetails.filename}" uploaded successfully but AI review could not start.`
      )

      // Ensure this returns a Promise
      return this.renderUploadSuccessView(h, fileDetails)
    }
  },

  /**
   * Render upload success view
   * @param {object} h - Hapi response toolkit
   * @param {object} fileDetails - File details from upload
   * @returns {object} View response
   */
  renderUploadSuccessView (h, fileDetails) {
    return h.view('upload/success', {
      pageTitle: 'Upload Successful',
      heading: 'Upload Successful',
      fileDetails: createFileDetailsForView(fileDetails)
    })
  },

  /**
   * Handle upload completion
   * @param {object} request - Hapi request object
   * @param {object} h - Hapi response toolkit
   * @returns {object} Redirect or view response
   */
  async uploadComplete (request, h) {
    const uploadId = request.yar.get('currentUploadId')
    console.log('[UPLOAD-CONTROLLER] Upload complete for:', uploadId)

    if (!uploadId) {
      return h.redirect('/')
    }

    try {
      const status = await getUploadStatus(uploadId)

      // Clear upload ID from session
      request.yar.clear('currentUploadId')

      const isUploadReady =
        status.uploadStatus === UPLOAD_STATUS_READY &&
        status.numberOfRejectedFiles === REJECTED_FILES_THRESHOLD

      if (isUploadReady) {
        const fileDetails = status.form?.file || {}
        const config = request.server.app.config
        const backendUrl = config.get('backendUrl')

        return await this.handleSuccessfulUpload(
          request,
          h,
          fileDetails,
          backendUrl
        )
      }

      // Handle rejected files
      request.yar.set('hasUploadSuccess', false)
      request.yar.flash(
        'uploadError',
        status.form?.file?.errorMessage ||
          'The file could not be uploaded. Please try again.'
      )

      return h.redirect('/')
    } catch (error) {
      console.error('Upload complete error:', error.message)
      request.logger.error(error, 'Failed to process upload completion')

      request.yar.set('hasUploadSuccess', false)
      request.yar.flash(
        'uploadError',
        'An error occurred while processing your upload.'
      )
      return h.redirect('/')
    }
  },

  /**
   * Handle callback from CDP uploader
   * @param {object} request - Hapi request object
   * @param {object} h - Hapi response toolkit
   * @returns {object} Response
   */
  async handleCallback (request, h) {
    try {
      const payload = request.payload
      request.logger.info({ payload }, 'Received upload callback')

      // Process the callback payload
      // This could trigger background processing, notifications, etc.

      return h.response({ received: true }).code(HTTP_STATUS_OK)
    } catch (error) {
      request.logger.error(error, 'Failed to process callback')
      return h
        .response({ error: 'Failed to process callback' })
        .code(HTTP_STATUS_SERVER_ERROR)
    }
  }
}

export { uploadController }
