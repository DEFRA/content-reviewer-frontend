import { config } from '../../../config/config.js'
import { fetch } from 'undici'

/**
 * CDP Uploader Client Service
 * Handles interaction with the CDP Uploader API
 */

const uploaderUrl = config.get('cdpUploader.url')

/**
 * Initiate an upload session with CDP Uploader
 * @param {Object} options - Upload options
 * @param {string} options.redirect - URL to redirect after upload
 * @param {string} options.callback - Callback URL for scan completion
 * @param {Object} options.metadata - Additional metadata
 * @returns {Promise<Object>} Upload session details
 */
async function initiateUpload({ redirect, callback, metadata = {} }) {
  const s3Bucket = config.get('cdpUploader.s3Bucket')
  const s3Path = config.get('cdpUploader.s3Path')
  const maxFileSize = config.get('cdpUploader.maxFileSize')
  const mimeTypes = config.get('cdpUploader.allowedMimeTypes')

  console.log('🔧 CDP UPLOADER CONFIG DEBUG:')
  console.log('- Uploader URL:', uploaderUrl)
  console.log('- S3 Bucket:', s3Bucket)
  console.log('- S3 Path:', s3Path)
  console.log('- Max File Size:', maxFileSize)
  console.log('- Allowed MIME Types:', mimeTypes)

  const payload = {
    redirect,
    s3Bucket,
    s3Path,
    metadata,
    mimeTypes,
    maxFileSize
  }

  if (callback) {
    payload.callback = callback
  }

  console.log(
    '📤 INITIATING UPLOAD with payload:',
    JSON.stringify(payload, null, 2)
  )

  const response = await fetch(`${uploaderUrl}/initiate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'content-reviewer-frontend'
    },
    body: JSON.stringify(payload)
  })

  console.log('📥 UPLOAD INITIATE RESPONSE:', {
    status: response.status,
    statusText: response.statusText,
    url: response.url
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error('❌ UPLOAD INITIATE FAILED:', errorText)
    throw new Error(
      `Failed to initiate upload: ${response.statusText} - ${errorText}`
    )
  }

  const responseData = await response.json()
  console.log(
    '✅ UPLOAD INITIATE SUCCESS:',
    JSON.stringify(responseData, null, 2)
  )

  return responseData
}

/**
 * Get upload status from CDP Uploader
 * @param {string} uploadId - The upload ID
 * @param {boolean} debug - Include debug information
 * @returns {Promise<Object>} Upload status
 */
async function getUploadStatus(uploadId, debug = false) {
  console.log(`🔍 CHECKING UPLOAD STATUS for ID: ${uploadId}`)

  const url = new URL(`${uploaderUrl}/status/${uploadId}`)
  if (debug) {
    url.searchParams.set('debug', 'true')
  }

  console.log('📞 STATUS REQUEST URL:', url.toString())

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      'User-Agent': 'content-reviewer-frontend'
    }
  })

  console.log('📋 STATUS RESPONSE:', {
    status: response.status,
    statusText: response.statusText,
    url: response.url
  })

  if (!response.ok) {
    console.error(
      `❌ FAILED TO GET UPLOAD STATUS for ${uploadId}:`,
      response.statusText
    )
    throw new Error(`Failed to get upload status: ${response.statusText}`)
  }

  const statusData = await response.json()
  console.log('📊 UPLOAD STATUS DATA:', JSON.stringify(statusData, null, 2))

  // Log S3 details if available
  if (statusData.form?.file?.s3Bucket || statusData.form?.file?.s3Key) {
    console.log('🗄️  S3 DETAILS:')
    console.log('- S3 Bucket:', statusData.form?.file?.s3Bucket || 'NOT SET')
    console.log('- S3 Key:', statusData.form?.file?.s3Key || 'NOT SET')
    console.log('- Filename:', statusData.form?.file?.filename || 'NOT SET')
    console.log(
      '- Content Type:',
      statusData.form?.file?.detectedContentType || 'NOT SET'
    )
  }

  return statusData
}

/**
 * Poll upload status until complete or rejected
 * @param {string} uploadId - The upload ID
 * @param {number} maxAttempts - Maximum polling attempts
 * @param {number} interval - Interval between polls in ms
 * @returns {Promise<Object>} Final upload status
 */
async function pollUploadStatus(uploadId, maxAttempts = 30, interval = 2000) {
  let attempts = 0

  while (attempts < maxAttempts) {
    const status = await getUploadStatus(uploadId)

    if (status.uploadStatus === 'ready') {
      return status
    }

    if (status.uploadStatus === 'rejected') {
      return status
    }

    attempts++
    await new Promise((resolve) => setTimeout(resolve, interval))
  }

  throw new Error('Upload status polling timeout')
}

export { initiateUpload, getUploadStatus, pollUploadStatus }
