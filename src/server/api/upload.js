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
const HTTP_STATUS_OK = 200

/**
 * Convert Hapi file stream to Buffer
 */
async function fileStreamToBuffer(file) {
  return new Promise((resolve, reject) => {
    const chunks = []

    if (!file.on) {
      // File is already a buffer or blob
      resolve(file)
      return
    }

    file.on('data', (chunk) => {
      chunks.push(chunk)
    })

    file.on('end', () => {
      resolve(Buffer.concat(chunks))
    })

    file.on('error', (error) => {
      reject(new Error(`File stream error: ${error.message}`))
    })
  })
}

/**
 * Send file to backend service as application/octet-stream
 */
async function sendFileToBackend(
  fileBuffer,
  fileName,
  contentType,
  mimeType,
  userId
) {
  const backendUrl = config.get('backendUrl')
  logger.info(
    `Preparing to forward file to backend service with filename: ${fileName} and content type: ${contentType}`
  )
  const backendRequestStart = Date.now()
  try {
    logger.info(
      `File converted to buffer. Size: ${fileBuffer.length} bytes for: ${fileName}`
    )

    const response = await undiciFetch(`${backendUrl}/api/upload`, {
      method: 'POST',
      body: fileBuffer,
      headers: {
        'content-type': 'application/octet-stream',
        'x-file-name': encodeURIComponent(fileName),
        'x-file-content-type': mimeType,
        'x-user-id': userId || 'content-reviewer-frontend'
      },
      dispatcher: keepAliveAgent
    })

    const backendRequestEnd = Date.now()
    const backendRequestTime = (backendRequestEnd - backendRequestStart) / 1000

    return { response, backendRequestTime }
  } catch (error) {
    logger.error('Error sending file to backend service')
    throw error
  }
}

/**
 * Handle backend upload failure
 */
async function handleBackendFailure(response, fileName, h) {
  let errorMessage = 'Failed to upload file to backend'
  try {
    const errorData = await response.json()
    errorMessage = errorData.message || errorMessage
  } catch {
    // Response body was not JSON — keep default message
  }
  logger.error(
    `Backend upload failed for file: ${fileName} with status: ${response.status} and message: ${errorMessage}`
  )
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
  fileName,
  backendRequestTime,
  startTime,
  h
) {
  const result = await response.json()
  const totalProcessingTime = (Date.now() - startTime) / 1000

  logger.info(
    `File: ${fileName} uploaded successfully to backend. Backend response time: ${backendRequestTime}s, Total processing time: ${totalProcessingTime}s`
  )

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

    logger.info(
      `Received upload request with content-type: ${request.headers['content-type']}`
    )

    try {
      // ✅ With octet-stream, request.payload is the raw stream (NOT an object)
      const fileStream = request.payload

      // ✅ Get filename from header (since we're not receiving multipart)
      const fileName = request.headers['x-file-name']
        ? decodeURIComponent(request.headers['x-file-name'])
        : `upload-${Date.now()}`

      const contentType =
        request.headers['content-type'] || 'application/octet-stream'
      const mimeType =
        request.headers['x-file-content-type'] || 'application/pdf'

      logger.info(
        `Extracted file info - filename: ${fileName}, contentType: ${contentType}, mimeType: ${mimeType}`
      )

      // ✅ Convert stream to buffer
      logger.info('Converting file stream to buffer...')
      const fileBuffer = await fileStreamToBuffer(fileStream)

      logger.info(
        `File converted to buffer. Size: ${fileBuffer.length} bytes for: ${fileName}`
      )

      const userId = getUserIdentifier(request)
      logger.info(`User identifier for upload: ${userId}`)

      // Send file to backend using the pre-buffered content
      const backendResult = await sendFileToBackend(
        fileBuffer,
        fileName,
        contentType,
        mimeType,
        userId
      )
      const response = backendResult.response
      const backendRequestTime = backendResult.backendRequestTime

      // Handle backend response
      if (response.ok) {
        logger.info(
          `Backend upload initiated successfully and waiting for upload status for reviewId=${response.reviewId}`
        )
        // Poll backend for upload status until it's no longer 'initiated'
        const uploadStatus = await waitForUpload(response.reviewId)
        logger.info(
          `Upload status for reviewId=${response.reviewId} is now ${uploadStatus.status}`
        )
        if (
          uploadStatus.status == 'rejected' ||
          uploadStatus.status == 'error'
        ) {
          logger.info(
            `Upload rejected for reviewId=${response.reviewId} with reason: ${uploadStatus.message}`
          )
          return h
            .response({
              success: false,
              message: uploadStatus.message
            })
            .code(HTTP_STATUS_INTERNAL_SERVER_ERROR)
        }
      } else {
        return await handleBackendFailure(response, fileName, h)
      }

      return await processSuccessfulUpload(
        response,
        fileName,
        backendRequestTime,
        startTime,
        h
      )
    } catch (error) {
      return handleUploadError(error, startTime, h)
    }
  }
}

async function waitForUpload(reviewId, interval = 1000, maxAttempts = 60) {
  let attempts = 0
  const backendUrl = config.get('backendUrl')
  while (attempts < maxAttempts) {
    attempts += 1
    try {
      const res = await fetch(`${backendUrl}/api/upload-status/${reviewId}`)
      if (res.status === 200) {
        const json = await res.json()
        if (
          json.status &&
          (json.status == 'rejected' ||
            json.status == 'completed' ||
            json.status == 'error')
        ) {
          return json
        }
      } else {
        logger.info(
          `Upload status check returned status ${res.status} for reviewId=${reviewId}`
        )
      }
    } catch (err) {
      throw new Error(`Failed to poll upload status: ${err.message}`)
    }
    await new Promise((r) => setTimeout(r, interval))
  }
  throw new Error(`Timeout waiting for upload status for reviewId=${reviewId}`)
}
