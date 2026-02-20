import FormData from 'form-data'
import fetch from 'node-fetch'
import { config } from '../../config/config.js'
import { createLogger } from '../common/helpers/logging/logger.js'

const logger = createLogger()

// HTTP Status Codes
const HTTP_STATUS_OK = 200
const HTTP_STATUS_BAD_REQUEST = 400
const HTTP_STATUS_SERVER_ERROR = 500

// File validation constants
const MAX_FILE_SIZE_MB = 10
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024
const BYTES_PER_MB = 1024 * 1024

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
]

const ALLOWED_EXTENSIONS = ['pdf', 'doc', 'docx']

/**
 * Extract file information from upload
 * @param {object} file - File object from request payload
 * @returns {object} File information
 */
function extractFileInfo (file) {
  return {
    filename: file.hapi.filename,
    size: file.bytes,
    sizeMB: (file.bytes / BYTES_PER_MB).toFixed(2),
    contentType: file.hapi.headers['content-type']
  }
}

/**
 * Validate file size
 * @param {object} file - File object
 * @param {object} fileInfo - File information
 * @returns {object|null} Error response or null if valid
 */
function validateFileSize (file, fileInfo) {
  if (file.bytes > MAX_FILE_SIZE_BYTES) {
    logger.warn('Upload validation failed: File too large', {
      filename: fileInfo.filename,
      size: fileInfo.sizeMB + 'MB',
      maxSize: `${MAX_FILE_SIZE_MB}MB`
    })
    return {
      success: false,
      message: `File too large. Maximum size is ${MAX_FILE_SIZE_MB}MB. Your file is ${fileInfo.sizeMB}MB.`
    }
  }
  return null
}

/**
 * Validate file type
 * @param {object} file - File object
 * @param {object} fileInfo - File information
 * @returns {object|null} Error response or null if valid
 */
function validateFileType (file, fileInfo) {
  const extension = file.hapi.filename.split('.').pop().toLowerCase()
  const contentType = file.hapi.headers['content-type']

  if (
    !ALLOWED_MIME_TYPES.includes(contentType) &&
    !ALLOWED_EXTENSIONS.includes(extension)
  ) {
    logger.warn('Upload validation failed: Invalid file type', {
      filename: fileInfo.filename,
      contentType: fileInfo.contentType,
      extension,
      allowedMimeTypes: ALLOWED_MIME_TYPES,
      allowedExtensions: ALLOWED_EXTENSIONS
    })
    return {
      success: false,
      message:
        'Invalid file type. Please upload a PDF or Word document (.pdf, .doc, .docx).'
    }
  }
  return null
}

/**
 * Upload file to backend
 * @param {object} file - File object
 * @param {object} fileInfo - File information
 * @param {object} request - Hapi request object
 * @returns {Promise<object>} Backend response
 */
async function uploadToBackend (file, fileInfo, request) {
  const backendUrl = config.get('backendUrl')
  logger.info('Preparing to forward file to backend', {
    backendUrl,
    filename: fileInfo.filename
  })

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
  const backendRequestTime = (backendRequestEnd - backendRequestStart) / 1000

  logger.info('Backend upload request completed', {
    filename: fileInfo.filename,
    responseStatus: response.status,
    responseStatusText: response.statusText,
    requestTime: `${backendRequestTime}s`,
    success: response.ok
  })

  return { response, backendRequestTime }
}

/**
 * Handle backend upload error
 * @param {object} response - Backend response
 * @param {number} backendRequestTime - Request time in seconds
 * @param {object} fileInfo - File information
 * @param {object} request - Hapi request object
 * @param {object} h - Hapi response toolkit
 * @returns {Promise<object>} Error response
 */
async function handleBackendError (
  response,
  backendRequestTime,
  fileInfo,
  request,
  h
) {
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
    .code(HTTP_STATUS_SERVER_ERROR)
}

/**
 * Handle successful upload
 * @param {object} response - Backend response
 * @param {number} backendRequestTime - Backend request time in seconds
 * @param {number} startTime - Total process start time
 * @param {object} fileInfo - File information
 * @param {object} request - Hapi request object
 * @param {object} h - Hapi response toolkit
 * @returns {Promise<object>} Success response
 */
async function handleUploadSuccess (
  response,
  backendRequestTime,
  startTime,
  fileInfo,
  request,
  h
) {
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
    .code(HTTP_STATUS_OK)
}

/**
 * API controller for handling file uploads
 */
export const uploadApiController = {
  /**
   * Handle file upload from frontend form
   * @param {object} request - Hapi request object
   * @param {object} h - Hapi response toolkit
   * @returns {Promise<object>} Response object
   */
  async uploadFile (request, h) {
    const startTime = Date.now()
    logger.info('Upload API request started', {
      userAgent: request.headers['user-agent'],
      clientIP: request.info.remoteAddress
    })

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
          .code(HTTP_STATUS_BAD_REQUEST)
      }

      const fileInfo = extractFileInfo(file)

      logger.info('File received for processing', {
        filename: fileInfo.filename,
        size: fileInfo.size,
        sizeMB: fileInfo.sizeMB,
        contentType: fileInfo.contentType
      })

      // Validate file size
      const sizeError = validateFileSize(file, fileInfo)
      if (sizeError) {
        return h.response(sizeError).code(HTTP_STATUS_BAD_REQUEST)
      }

      // Validate file type
      const typeError = validateFileType(file, fileInfo)
      if (typeError) {
        return h.response(typeError).code(HTTP_STATUS_BAD_REQUEST)
      }

      logger.info('File validation passed successfully', {
        filename: fileInfo.filename,
        sizeMB: fileInfo.sizeMB,
        contentType: fileInfo.contentType
      })

      // Upload file to backend
      const { response, backendRequestTime } = await uploadToBackend(
        file,
        fileInfo,
        request
      )

      if (!response.ok) {
        return await handleBackendError(
          response,
          backendRequestTime,
          fileInfo,
          request,
          h
        )
      }

      return await handleUploadSuccess(
        response,
        backendRequestTime,
        startTime,
        fileInfo,
        request,
        h
      )
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
        .code(HTTP_STATUS_SERVER_ERROR)
    }
  }
}
