import { randomUUID } from 'node:crypto'
import { fetch } from 'undici'
import { config } from '../../config/config.js'
import { initiateUpload } from '../common/helpers/cdp-uploader-client.js'
import { getUserIdentifier } from '../common/helpers/get-user-identifier.js'

const HTTP_STATUS_OK = 200
const HTTP_STATUS_SERVER_ERROR = 500

async function collectStream(stream) {
  const chunks = []
  for await (const chunk of stream) {
    chunks.push(chunk)
  }
  return Buffer.concat(chunks)
}

/**
 * Proxy file upload to CDP Uploader server-to-server, eliminating the CORS
 * restriction that blocks direct browser-to-CDP fetch calls.
 *
 * Flow:
 *  1. Browser POSTs multipart/form-data to /api/review/file (same-origin)
 *  2. Server calls CDP Uploader /initiate to register the callback URL
 *  3. Server proxies the file bytes to CDP Uploader /upload-and-scan (S2S)
 *  4. CDP Uploader scans the file, then calls /upload-callback server-to-server
 *  5. Server returns { reviewId } so the browser can show a pending history entry
 */
async function fileReviewHandler(request, h) {
  try {
    const reviewId = randomUUID()
    const backendUrl = config.get('backendUrl')
    const cdpUploaderBaseUrl = config.get('cdpUploader.url')
    const userId = getUserIdentifier(request) || request.yar?.id || 'unknown'

    // Step 1: Register an upload session — CDP Uploader will call callbackUrl
    // server-to-server after the virus scan completes.
    const callbackUrl = `${backendUrl}/upload-callback`
    const uploadSession = await initiateUpload({
      redirect: '/',
      callback: callbackUrl,
      metadata: { reviewId, userId }
    })

    const uploadUrl = new URL(uploadSession.uploadUrl, cdpUploaderBaseUrl).href

    // Step 2: Stream the file from the browser request into a buffer, then
    // POST it to CDP Uploader. Server-to-server calls have no CORS restriction.
    const fileStream = request.payload.file
    const filename = fileStream.hapi?.filename || 'upload'
    const mimeType =
      fileStream.hapi?.headers?.['content-type'] || 'application/octet-stream'

    const fileBuffer = await collectStream(fileStream)

    const formData = new FormData()
    formData.append(
      'file',
      new Blob([fileBuffer], { type: mimeType }),
      filename
    )

    const cdpResponse = await fetch(uploadUrl, {
      method: 'POST',
      body: formData,
      redirect: 'manual' // intercept 302 without following — we don't use the redirect
    })

    // CDP Uploader returns 302 on success (opaqueredirect with redirect:'manual').
    // Any non-redirect, non-ok response indicates a rejection (e.g. virus, wrong type).
    if (cdpResponse.type !== 'opaqueredirect' && !cdpResponse.ok) {
      request.logger.error(
        { status: cdpResponse.status, filename },
        'CDP Uploader rejected the file'
      )
      return h
        .response({ message: 'File upload rejected. Please try again.' })
        .code(HTTP_STATUS_SERVER_ERROR)
    }

    request.logger.info(
      { reviewId, filename, bytes: fileBuffer.length },
      'File proxied to CDP Uploader successfully'
    )
    return h.response({ reviewId }).code(HTTP_STATUS_OK)
  } catch (error) {
    request.logger.error(error, 'File review upload failed')
    return h
      .response({ message: 'Failed to upload file. Please try again.' })
      .code(HTTP_STATUS_SERVER_ERROR)
  }
}

export { fileReviewHandler }
