import { Agent, fetch as undiciFetch } from 'undici'
import { config } from '../../config/config.js'
import { createLogger } from '../common/helpers/logging/logger.js'
import { getUserIdentifier } from '../common/helpers/get-user-identifier.js'
import { readFile } from 'node:fs/promises'

const logger = createLogger()

// Reuse a single undici Agent with keep-alive for all upload backend calls
const keepAliveAgent = new Agent({
  keepAliveTimeout: 30_000,
  keepAliveMaxTimeout: 300_000,
  connections: 5
})

const HTTP_STATUS_INTERNAL_SERVER_ERROR = 500
const HTTP_STATUS_BAD_REQUEST = 400
const HTTP_STATUS_OK = 200
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024
const MAX_FILE_SIZE_MB = 10
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
]
const ALLOWED_EXTENSIONS = ['pdf', 'doc', 'docx']

/**
 * Extract file information for logging and validation
 */
function extractFileInfo(file) {
  return {
    filename: file?.hapi?.filename || file?.filename,
    contentType:
      file?.hapi?.headers?.['content-type'] ||
      file?.headers?.['content-type'] ||
      file?.contentType
  }
}

/**
 * Validate file is present in request
 */
function validateFilePresent(file, h) {
  if (!file) {
    logger.warn('Upload request failed: No file provided')
    return h
      .response({
        success: false,
        message: 'No file provided'
      })
      .code(HTTP_STATUS_BAD_REQUEST)
  }
  return null
}

/**
 * Validate file size does not exceed maximum.
 * Receives the actual byte length from the buffered content.
 */
function validateFileSize(byteLength, fileInfo, h) {
  if (byteLength > MAX_FILE_SIZE_BYTES) {
    const sizeMB = (byteLength / 1024 / 1024).toFixed(2)
    logger.warn('Upload validation failed: File too large', {
      filename: fileInfo.filename,
      size: sizeMB + 'MB',
      maxSize: MAX_FILE_SIZE_MB + 'MB'
    })
    return h
      .response({
        success: false,
        message: `File too large. Maximum size is ${MAX_FILE_SIZE_MB}MB. Your file is ${sizeMB}MB.`
      })
      .code(HTTP_STATUS_BAD_REQUEST)
  }
  return null
}

/**
 * Validate file type is allowed
 */
function validateFileType(fileInfo, h) {
  const extension = fileInfo.filename.split('.').pop().toLowerCase()
  const contentType = fileInfo.contentType

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
    return h
      .response({
        success: false,
        message:
          'Invalid file type. Please upload a PDF or Word document (.pdf, .doc, .docx).'
      })
      .code(HTTP_STATUS_BAD_REQUEST)
  }
  return null
}

/**
 * Send file to backend service as application/octet-stream
 */
async function sendFileToBackend(file, fileBuffer, fileInfo, request) {
  const backendUrl = config.get('backendUrl')
  logger.info('Preparing to forward file to backend', {
    backendUrl,
    filename: fileInfo.filename
  })

  const backendRequestStart = Date.now()

  logger.info('Initiating backend upload request', {
    filename: fileInfo.filename,
    contentType: fileInfo.contentType,
    bodyBytes: fileBuffer.length,
    backendEndpoint: `${backendUrl}/api/upload`
  })

  logger.info(`Uploading file to backend: ${fileInfo.filename}`)

  const userId = getUserIdentifier(request)
  try {
    const formData = new FormData()
    formData.append('file', file)

    const response = await undiciFetch(`${backendUrl}/api/upload`, {
      method: 'POST',
      body: formData,
      headers: {
        'x-file-name': encodeURIComponent(fileInfo.filename),
        ...(userId ? { 'x-user-id': userId } : {})
      },
      dispatcher: keepAliveAgent
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
  } catch (error) {
    const backendRequestEnd = Date.now()
    const backendRequestTime = (backendRequestEnd - backendRequestStart) / 1000
    logger.error('Backend upload network error', {
      filename: fileInfo.filename, // ✅ Use fileInfo
      error: error.message,
      errorCode: error.code,
      requestTime: `${backendRequestTime}s`,
      userId
    })
    throw error
  }
}

/**
 * Handle backend upload failure
 */
async function handleBackendFailure(response, fileInfo, backendRequestTime, h) {
  let errorMessage = 'Failed to upload file to backend'
  try {
    const errorData = await response.json()
    errorMessage = errorData.message || errorMessage
  } catch {
    // Response body was not JSON — keep default message
  }
  logger.error('Backend upload request failed', {
    filename: fileInfo.filename,
    status: response.status,
    statusText: response.statusText,
    errorMessage,
    requestTime: `${backendRequestTime}s`
  })
  return h
    .response({
      success: false,
      message: errorMessage
    })
    .code(HTTP_STATUS_INTERNAL_SERVER_ERROR)
}

/**
 * Process successful backend response
 */
async function processSuccessfulUpload(
  response,
  fileInfo,
  backendRequestTime,
  startTime,
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

  logger.info(`File uploaded successfully: ${result.reviewId || 'unknown'}`)

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
 * Handle unexpected errors thrown during uploadFile
 */
function handleUploadError(error, startTime, h) {
  const totalProcessingTime = (Date.now() - startTime) / 1000

  logger.error('Upload API request failed with error', {
    error: error.message,
    stack: error.stack,
    totalProcessingTime: `${totalProcessingTime}s`
  })

  return h
    .response({
      success: false,
      message: error.message || 'Internal server error'
    })
    .code(HTTP_STATUS_INTERNAL_SERVER_ERROR)
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
  async uploadFile(request, h) {
    const startTime = Date.now()
    logger.info('Upload API request started', {
      userAgent: request.headers['user-agent'],
      clientIP: request.info.remoteAddress
    })

    try {
      const file = request.payload.file

      logger.info('Processing upload request', {
        hasFile: !!file,
        userAgent: request.headers['user-agent'],
        clientIP: request.info.remoteAddress
      })

      // Validate file is present
      const fileNotPresentError = validateFilePresent(file, h)
      if (fileNotPresentError) {
        return fileNotPresentError
      }

      const fileInfo = extractFileInfo(file)

      // Validate file type before buffering (cheap check, no I/O)
      const fileTypeError = validateFileType(fileInfo, h)
      if (fileTypeError) {
        return fileTypeError
      }

      // Buffer the file once — needed for size validation and form-data forwarding
      const fileBuffer = await readFile(file.path)

      logger.info('File received for processing', {
        filename: fileInfo.filename,
        byteLength: fileBuffer.length,
        contentType: fileInfo.contentType
      })

      // Validate file size using actual buffered byte count
      const fileSizeError = validateFileSize(fileBuffer.length, fileInfo, h)
      if (fileSizeError) {
        return fileSizeError
      }

      logger.info('File validation passed successfully', {
        filename: fileInfo.filename,
        byteLength: fileBuffer.length,
        contentType: fileInfo.contentType
      })

      // Send file to backend using the pre-buffered content
      const backendResult = await sendFileToBackend(
        file,
        fileBuffer,
        fileInfo,
        request
      )
      const response = backendResult.response
      const backendRequestTime = backendResult.backendRequestTime

      // Handle backend response
      if (!response.ok) {
        return await handleBackendFailure(
          response,
          fileInfo,
          backendRequestTime,
          h
        )
      }

      return await processSuccessfulUpload(
        response,
        fileInfo,
        backendRequestTime,
        startTime,
        h
      )
    } catch (error) {
      return handleUploadError(error, startTime, h)
    }
  },

  async handleUploadSuccess (request, h) {
  try {
    const { reviewId } = request.query

    request.logger.info(
      {
        reviewId,
        source: 'browser-redirect'
      },
      '[REDIRECT] Browser redirected from CDP Uploader'
    )

    // ✅ Can either:
    // 1. Return JSON response (for frontend to handle)

    // Option 1: Return JSON (for single-page app)
    return h
      .response({
        success: true,
        message: 'File upload completed successfully',
        reviewId,
        status: 'processing' // Pipeline is running asynchronously
      })
      .code(200)
  } catch (error) {
    request.logger.error(
      { error: error.message, query: request.query },
      '[REDIRECT] Handler failed'
    )

    return h
      .response({ success: false, message: error.message })
      .code(500)
  }
},
async handleUploadCallback(request, h) {
  const requestStartTime = performance.now()

  try {
    const { uploadStatus, metadata, form, numberOfRejectedFiles } =
      request.payload

    // ✅ Extract complete metadata from CDP Uploader POST
    request.logger.info(
      { uploadStatus, metadata, numberOfRejectedFiles },
      'Upload callback received from CDP Uploader'
    )

    // Get file details from form
    const fileField = form.file

    if (fileField.hasError) {
      request.logger.error(
        { errorMessage: fileField.errorMessage },
        'File rejected with error in callback'
      )
      return h
        .response({
          success: false,
          message: fileField.errorMessage || 'File validation failed'
        })
        .code(200)
    }

    // validateUploadCallbackPayload(
    //   uploadStatus,
    //   numberOfRejectedFiles,
    //   fileField
    // )

    // const userId = metadata?.userId
    const reviewId = metadata?.reviewId

    // ✅ Return 200 OK to CDP Uploader immediately
    return h
      .response({
        success: true,
        message: 'Callback received',
        reviewId
      })
      .code(200)
  } catch (error) {
    const totalDuration = Math.round(performance.now() - requestStartTime)

    request.logger.error(
      {
        error: error.message,
        stack: error.stack,
        durationMs: totalDuration
      },
      '[CALLBACK] Handler failed'
    )

    return h
      .response({ success: false, message: error.message })
      .code(500)
  }
}
}

// Validate the callback payload structure and values
function validateUploadCallbackPayload(
  uploadStatus,
  numberOfRejectedFiles,
  fileField
) {
  if (uploadStatus !== 'ready') {
    const error = new Error('Upload not ready yet')
    error.statusCode = 500
    error.details = { uploadStatus }
    throw error
  }

  if (numberOfRejectedFiles > 0) {
    const error = new Error(
      `Upload validation failed: ${numberOfRejectedFiles} files rejected`
    )
    error.statusCode = 500
    error.details = { numberOfRejectedFiles }
    throw error
  }

  if (fileField?.fileStatus !== 'complete') {
    const error = new Error('File not available or incomplete')
    error.statusCode = 500
    error.details = { fileStatus: fileField?.fileStatus }
    throw error
  }

  if (fileField?.hasError) {
    const errorMessage = fileField.errorMessage || 'File validation failed'
    const error = new Error(errorMessage)
    error.statusCode = 500
    error.details = { hasError: true, errorMessage }
    throw error
  }
}
