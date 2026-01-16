import FormData from 'form-data'
import fetch from 'node-fetch'
import { config } from '../../config/config.js'
import { createLogger } from '../common/helpers/logging/logger.js'

const logger = createLogger()

/**
 * API controller for handling file uploads
 */
export const uploadApiController = {
  /**
   * Handle file upload from frontend form
   */
  async uploadFile(request, h) {
    const startTime = Date.now()
    logger.info('Upload API request started')

    try {
      const { file } = request.payload

      logger.info('Processing upload request', {
        hasFile: !!file,
        userAgent: request.headers['user-agent'],
        clientIP: request.info.remoteAddress
      })

      if (!file) {
        logger.warn('Upload request failed: No file provided')
        return h
          .response({
            success: false,
            message: 'No file provided'
          })
          .code(400)
      }

      const fileInfo = {
        filename: file.hapi.filename,
        size: file.bytes,
        sizeMB: (file.bytes / 1024 / 1024).toFixed(2),
        contentType: file.hapi.headers['content-type']
      }

      logger.info('File received for processing', fileInfo)

      // Validate file size (10MB max)
      const maxSize = 10 * 1024 * 1024
      if (file.bytes > maxSize) {
        logger.warn('Upload validation failed: File too large', {
          filename: fileInfo.filename,
          size: fileInfo.sizeMB + 'MB',
          maxSize: '10MB'
        })
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
        logger.warn('Upload validation failed: Invalid file type', {
          filename: fileInfo.filename,
          contentType: fileInfo.contentType,
          extension,
          allowedMimeTypes,
          allowedExtensions
        })
        return h
          .response({
            success: false,
            message:
              'Invalid file type. Please upload a PDF or Word document (.pdf, .doc, .docx).'
          })
          .code(400)
      }

      logger.info('File validation passed successfully', fileInfo)

      // Forward file to backend
      const backendUrl = config.get('backendUrl')
      logger.info('Preparing to forward file to backend', { backendUrl })

      const formData = new FormData()
      formData.append('file', file, {
        filename: file.hapi.filename,
        contentType: file.hapi.headers['content-type']
      })

      const backendRequestStart = Date.now()
      logger.info('Initiating backend upload request', {
        filename: fileInfo.filename,
        size: fileInfo.sizeMB + 'MB',
        backendEndpoint: `${backendUrl}/api/upload`
      })

      request.logger.info(
        `Uploading file to backend: ${file.hapi.filename} (${file.bytes} bytes)`
      )

      const response = await fetch(`${backendUrl}/api/upload`, {
        method: 'POST',
        body: formData,
        headers: formData.getHeaders()
      })

      const backendRequestEnd = Date.now()
      const backendRequestTime =
        (backendRequestEnd - backendRequestStart) / 1000

      logger.info('Backend upload request completed', {
        filename: fileInfo.filename,
        responseStatus: response.status,
        responseStatusText: response.statusText,
        requestTime: `${backendRequestTime}s`,
        success: response.ok
      })

      if (!response.ok) {
        const error = await response.text()
        logger.error('Backend upload request failed', {
          filename: fileInfo.filename,
          status: response.status,
          statusText: response.statusText,
          errorResponse: error,
          requestTime: `${backendRequestTime}s`
        })
        request.logger.error(`Backend upload failed: ${error}`)
        return h
          .response({
            success: false,
            message: 'Failed to upload file to backend'
          })
          .code(500)
      }

      const result = await response.json()
      const totalProcessingTime = (Date.now() - startTime) / 1000

      logger.info('Upload completed successfully', {
        filename: fileInfo.filename,
        reviewId: result.reviewId,
        totalProcessingTime: `${totalProcessingTime}s`,
        backendRequestTime: `${backendRequestTime}s`
      })

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
      const totalProcessingTime = (Date.now() - startTime) / 1000

      logger.error('Upload API request failed with error', {
        error: error.message,
        stack: error.stack,
        totalProcessingTime: `${totalProcessingTime}s`
      })

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
