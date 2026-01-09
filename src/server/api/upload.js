import FormData from 'form-data'
import fetch from 'node-fetch'

/**
 * API controller for handling file uploads
 */
export const uploadApiController = {
  /**
   * Handle file upload from frontend form
   */
  async uploadFile(request, h) {
    try {
      const { file } = request.payload

      if (!file) {
        return h
          .response({
            success: false,
            message: 'No file provided'
          })
          .code(400)
      }

      // Validate file size (10MB max)
      const maxSize = 10 * 1024 * 1024
      if (file.bytes > maxSize) {
        return h
          .response({
            success: false,
            message: `File too large. Maximum size is 10MB. Your file is ${(file.bytes / 1024 / 1024).toFixed(2)}MB.`
          })
          .code(400)
      }

      // Validate file type
      const allowedMimeTypes = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      ]

      const allowedExtensions = ['pdf', 'doc', 'docx']
      const extension = file.hapi.filename.split('.').pop().toLowerCase()

      if (
        !allowedMimeTypes.includes(file.hapi.headers['content-type']) &&
        !allowedExtensions.includes(extension)
      ) {
        return h
          .response({
            success: false,
            message:
              'Invalid file type. Please upload a PDF or Word document (.pdf, .doc, .docx).'
          })
          .code(400)
      }

      // Forward file to backend
      const config = request.server.app.config
      const backendUrl = config.get('backendUrl')

      const formData = new FormData()
      formData.append('file', file, {
        filename: file.hapi.filename,
        contentType: file.hapi.headers['content-type']
      })

      request.logger.info(
        `Uploading file to backend: ${file.hapi.filename} (${file.bytes} bytes)`
      )

      const response = await fetch(`${backendUrl}/api/upload`, {
        method: 'POST',
        body: formData,
        headers: formData.getHeaders()
      })

      if (!response.ok) {
        const error = await response.text()
        request.logger.error(`Backend upload failed: ${error}`)
        return h
          .response({
            success: false,
            message: 'Failed to upload file to backend'
          })
          .code(500)
      }

      const result = await response.json()

      request.logger.info(
        `File uploaded successfully: ${result.reviewId || 'unknown'}`
      )

      return h
        .response({
          success: true,
          message: 'File uploaded successfully',
          reviewId: result.reviewId,
          filename: result.filename
        })
        .code(200)
    } catch (error) {
      request.logger.error(error, 'Error handling file upload')
      return h
        .response({
          success: false,
          message: error.message || 'Internal server error'
        })
        .code(500)
    }
  }
}
