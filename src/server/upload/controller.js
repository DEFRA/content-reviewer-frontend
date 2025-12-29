import {
  initiateUpload,
  getUploadStatus
} from '../common/helpers/cdp-uploader-client.js'

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
   * Initiate upload and redirect to CDP uploader
   */
  async initiateUpload(request, h) {
    try {
      const host = `${request.server.info.protocol}://${request.info.host}`
      const redirectUrl = `${host}/upload/status-poller`
      const callbackUrl = `${host}/upload/callback`

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
  async statusPoller(request, h) {
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
   */
  async getStatus(request, h) {
    try {
      const { uploadId } = request.params

      const status = await getUploadStatus(uploadId)

      return h.response(status).code(200)
    } catch (error) {
      request.logger.error(error, 'Failed to get upload status')
      return h.response({ error: 'Failed to get upload status' }).code(500)
    }
  },

  /**
   * Handle upload completion
   */
  async uploadComplete(request, h) {
    const uploadId = request.yar.get('currentUploadId')

    if (!uploadId) {
      return h.redirect('/')
    }

    try {
      const status = await getUploadStatus(uploadId)

      // Clear upload ID from session
      request.yar.clear('currentUploadId')

      if (
        status.uploadStatus === 'ready' &&
        status.numberOfRejectedFiles === 0
      ) {
        // Get file details
        const fileDetails = status.form?.file || {}

        // Store success message in session flash
        request.yar.flash('uploadSuccess', {
          filename: fileDetails.filename,
          size: fileDetails.contentLength,
          type: fileDetails.detectedContentType,
          fileId: fileDetails.fileId,
          s3Location: `${fileDetails.s3Bucket}/${fileDetails.s3Key}`
        })

        // Redirect to home with success message
        return h.redirect('/')
      } else {
        // Handle rejected files - store error in session
        request.yar.flash(
          'uploadError',
          status.form?.file?.errorMessage ||
            'The file could not be uploaded. Please try again.'
        )

        return h.redirect('/')
      }
    } catch (error) {
      request.logger.error(error, 'Failed to process upload completion')
      request.yar.flash(
        'uploadError',
        'An error occurred while processing your upload.'
      )
      return h.redirect('/')
    }
  },

  /**
   * Handle callback from CDP uploader
   */
  async handleCallback(request, h) {
    try {
      const payload = request.payload
      request.logger.info({ payload }, 'Received upload callback')

      // Process the callback payload
      // This could trigger background processing, notifications, etc.

      return h.response({ received: true }).code(200)
    } catch (error) {
      request.logger.error(error, 'Failed to process callback')
      return h.response({ error: 'Failed to process callback' }).code(500)
    }
  }
}

export { uploadController }
