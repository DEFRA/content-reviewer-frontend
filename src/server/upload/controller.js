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

      console.log('🚀 Initiating upload')

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

      console.log('✅ Upload session created:', uploadSession.uploadId)

      // Store uploadId in session
      request.yar.set('currentUploadId', uploadSession.uploadId)

      // Redirect to CDP uploader upload page
      return h.redirect(uploadSession.uploadUrl)
    } catch (error) {
      console.error('❌ UPLOAD INITIATION FAILED:', error)
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
    console.log('🏁 Upload complete for:', uploadId)

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
        console.log('✅ Upload successful, processing file...')

        // Get file details
        const fileDetails = status.form?.file || {}

        console.log('🗄️ S3 Upload:', fileDetails.s3Bucket, fileDetails.s3Key)

        // Trigger AI review in backend
        const config = request.server.app.config
        const backendUrl = config.get('backendUrl')
        console.log('🤖 Triggering AI review at:', backendUrl)

        try {
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

          if (reviewResponse.ok) {
            const reviewData = await reviewResponse.json()
            console.log('✅ AI review initiated:', reviewData.reviewId)

            const reviewId = reviewData.reviewId

            // Store review ID in session
            request.yar.set('currentReviewId', reviewId)

            // Set upload success flag AND flash message
            request.yar.set('hasUploadSuccess', true)
            request.yar.flash(
              'uploadSuccess',
              `File "${fileDetails.filename}" uploaded successfully and AI review initiated.`
            )

            // Redirect to review status poller
            return h.redirect(`/review/status-poller/${reviewId}`)
          } else {
            await reviewResponse.text()
            console.error('❌ Backend review failed:', reviewResponse.status)
            request.logger.error('Failed to initiate AI review')

            // Still set success flag since file uploaded successfully to S3
            request.yar.set('hasUploadSuccess', true)
            request.yar.flash(
              'uploadSuccess',
              `File "${fileDetails.filename}" uploaded successfully but AI review could not start automatically.`
            )

            // Fallback to success page
            return h.view('upload/success', {
              pageTitle: 'Upload Successful',
              heading: 'Upload Successful',
              fileDetails: {
                filename: fileDetails.filename,
                contentLength: fileDetails.contentLength,
                detectedContentType: fileDetails.detectedContentType,
                fileId: fileDetails.fileId,
                s3Bucket: fileDetails.s3Bucket,
                s3Key: fileDetails.s3Key,
                fileStatus: 'Uploaded (Review pending)'
              }
            })
          }
        } catch (error) {
          console.error('❌ Backend request failed:', error.message)
          request.logger.error(error, 'Error triggering AI review')

          // Still set success flag since file uploaded successfully to S3
          request.yar.set('hasUploadSuccess', true)
          request.yar.flash(
            'uploadSuccess',
            `File "${fileDetails.filename}" uploaded successfully but AI review could not start due to backend communication error.`
          )

          // Fallback to success page
          return h.view('upload/success', {
            pageTitle: 'Upload Successful',
            heading: 'Upload Successful',
            fileDetails: {
              filename: fileDetails.filename,
              contentLength: fileDetails.contentLength,
              detectedContentType: fileDetails.detectedContentType,
              fileId: fileDetails.fileId,
              s3Bucket: fileDetails.s3Bucket,
              s3Key: fileDetails.s3Key,
              fileStatus: 'Uploaded (Review pending)'
            }
          })
        }
      } else {
        console.log('❌ Upload failed:', status.uploadStatus)

        request.yar.set('hasUploadSuccess', false)

        // Handle rejected files - store error in session
        request.yar.flash(
          'uploadError',
          status.form?.file?.errorMessage ||
            'The file could not be uploaded. Please try again.'
        )

        return h.redirect('/')
      }
    } catch (error) {
      console.error('❌ Upload complete error:', error.message)
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
