import FormData from 'form-data'
import { Agent, fetch as undiciFetch } from 'undici'
import { config } from '../../config/config.js'
import { createLogger } from '../common/helpers/logging/logger.js'
import { getUserIdentifier } from '../common/helpers/get-user-identifier.js'

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
    filename: file.hapi.filename,
    size: file.bytes,
    sizeMB: (file.bytes / 1024 / 1024).toFixed(2),
    contentType: file.hapi.headers['content-type']
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
function validateFileType(file, fileInfo, h) {
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
 * Buffer a Node.js readable stream into a single Buffer.
 */
async function streamToBuffer(stream) {
  const chunks = []
  for await (const chunk of stream) {
    chunks.push(chunk)
  }
  return Buffer.concat(chunks)
}

/**
 * Create FormData for backend upload from a pre-buffered file.
 * Using a Buffer (with knownLength) ensures form-data includes a Content-Length
 * header for the part, which prevents multipart parsing errors on the backend.
 */
function createUploadFormData(fileBuffer, filename, contentType) {
  const formData = new FormData()
  formData.append('file', fileBuffer, {
    filename,
    contentType,
    knownLength: fileBuffer.length
  })
  return formData
}

/**
 * Send file to backend service
 */
async function sendFileToBackend(file, fileBuffer, fileInfo, request) {
  const backendUrl = config.get('backendUrl')
  logger.info('Preparing to forward file to backend', {
    backendUrl,
    filename: fileInfo.filename
  })

  const formData = createUploadFormData(
    fileBuffer,
    file.hapi.filename,
    file.hapi.headers['content-type']
  )
  const backendRequestStart = Date.now()

  logger.info('Initiating backend upload request', {
    filename: fileInfo.filename,
    contentType: file.hapi.headers['content-type'],
    backendEndpoint: `${backendUrl}/api/upload`
  })

  request.logger.info(`Uploading file to backend: ${file.hapi.filename}`)

  const userId = getUserIdentifier(request)
  const response = await undiciFetch(`${backendUrl}/api/upload`, {
    method: 'POST',
    body: formData,
    headers: {
      ...formData.getHeaders(),
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
      const fileTypeError = validateFileType(file, fileInfo, h)
      if (fileTypeError) {
        return fileTypeError
      }

      // Buffer the stream once — needed for size validation and form-data forwarding
      const fileBuffer = await streamToBuffer(file)

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
      return h
        .response({
          success: false,
          message: error.message || 'Internal server error'
        })
        .code(HTTP_STATUS_INTERNAL_SERVER_ERROR)
    }
  }
}
