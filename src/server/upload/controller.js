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

      console.log('🚀 INITIATING UPLOAD:')
      console.log('- Host:', host)
      console.log('- Redirect URL:', redirectUrl)
      console.log('- Callback URL:', callbackUrl)

      // Get metadata from form if any
      const metadata = {
        userId: request.yar?.id || 'anonymous',
        timestamp: new Date().toISOString()
      }

      console.log('📝 Upload metadata:', JSON.stringify(metadata, null, 2))

      const uploadSession = await initiateUpload({
        redirect: redirectUrl,
        callback: callbackUrl,
        metadata
      })

      console.log('🎫 Upload session created:', {
        uploadId: uploadSession.uploadId,
        uploadUrl: uploadSession.uploadUrl
      })

      // Store uploadId in session
      request.yar.set('currentUploadId', uploadSession.uploadId)
      console.log('💾 Stored uploadId in session:', uploadSession.uploadId)

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
    console.log('🏁 UPLOAD COMPLETE called for uploadId:', uploadId)

    if (!uploadId) {
      console.log('❌ No uploadId found in session, redirecting to home')
      return h.redirect('/')
    }

    try {
      const status = await getUploadStatus(uploadId)
      console.log('📈 Final upload status:', JSON.stringify(status, null, 2))

      // Clear upload ID from session
      request.yar.clear('currentUploadId')
      console.log('🧹 Cleared uploadId from session')

      if (
        status.uploadStatus === 'ready' &&
        status.numberOfRejectedFiles === 0
      ) {
        console.log('✅ Upload successful, processing file...')

        // Get file details
        const fileDetails = status.form?.file || {}
        console.log('📄 File details:', JSON.stringify(fileDetails, null, 2))

        // Log S3 information specifically
        console.log('🗄️  S3 UPLOAD SUCCESS:')
        console.log('- S3 Bucket:', fileDetails.s3Bucket || 'MISSING')
        console.log('- S3 Key:', fileDetails.s3Key || 'MISSING')
        console.log('- Filename:', fileDetails.filename || 'MISSING')
        console.log(
          '- Content Type:',
          fileDetails.detectedContentType || 'MISSING'
        )
        console.log('- File Size:', fileDetails.contentLength || 'MISSING')

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

          console.log(
            '📤 Sending review payload to backend:',
            JSON.stringify(reviewPayload, null, 2)
          )

          const reviewResponse = await fetch(`${backendUrl}/upload`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(reviewPayload)
          })

          console.log('📥 Backend review response:', {
            status: reviewResponse.status,
            statusText: reviewResponse.statusText,
            url: reviewResponse.url
          })

          if (reviewResponse.ok) {
            const reviewData = await reviewResponse.json()
            console.log(
              '✅ Backend review initiated successfully:',
              JSON.stringify(reviewData, null, 2)
            )

            const reviewId = reviewData.reviewId
            console.log('🆔 Review ID received:', reviewId)

            // Store review ID in session
            request.yar.set('currentReviewId', reviewId)
            console.log('💾 Stored reviewId in session')

            // Set upload success flag AND flash message
            request.yar.set('hasUploadSuccess', true)
            request.yar.flash(
              'uploadSuccess',
              `File "${fileDetails.filename}" uploaded successfully and AI review initiated.`
            )
            console.log('🎯 SET hasUploadSuccess = true + flash message')

            // Redirect to review status poller
            return h.redirect(`/review/status-poller/${reviewId}`)
          } else {
            const errorText = await reviewResponse.text()
            console.error('❌ Backend review failed:', {
              status: reviewResponse.status,
              statusText: reviewResponse.statusText,
              errorText
            })
            request.logger.error('Failed to initiate AI review')

            // Still set success flag since file uploaded successfully to S3
            request.yar.set('hasUploadSuccess', true)
            request.yar.flash(
              'uploadSuccess',
              `File "${fileDetails.filename}" uploaded successfully but AI review could not start automatically.`
            )
            console.log(
              '⚠️  SET hasUploadSuccess = true + flash message (despite backend error)'
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
          console.error('❌ BACKEND REQUEST FAILED:', error)
          request.logger.error(error, 'Error triggering AI review')

          // Still set success flag since file uploaded successfully to S3
          request.yar.set('hasUploadSuccess', true)
          request.yar.flash(
            'uploadSuccess',
            `File "${fileDetails.filename}" uploaded successfully but AI review could not start due to backend communication error.`
          )
          console.log(
            '⚠️  SET hasUploadSuccess = true + flash message (despite backend communication error)'
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
        console.log('❌ Upload failed or was rejected:')
        console.log('- Upload Status:', status.uploadStatus)
        console.log('- Rejected Files:', status.numberOfRejectedFiles)
        console.log('- Status Details:', JSON.stringify(status, null, 2))

        request.yar.set('hasUploadSuccess', false)
        console.log('🚫 SET hasUploadSuccess = false')

        // Handle rejected files - store error in session
        request.yar.flash(
          'uploadError',
          status.form?.file?.errorMessage ||
            'The file could not be uploaded. Please try again.'
        )

        return h.redirect('/')
      }
    } catch (error) {
      console.error('❌ UPLOAD COMPLETE ERROR:', error)
      request.logger.error(error, 'Failed to process upload completion')

      request.yar.set('hasUploadSuccess', false)
      console.log('🚫 SET hasUploadSuccess = false (catch block)')

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
