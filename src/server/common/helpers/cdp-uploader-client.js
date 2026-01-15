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

  const response = await fetch(`${uploaderUrl}/initiate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'content-reviewer-frontend'
    },
    body: JSON.stringify(payload)
  })

  if (!response.ok) {
    throw new Error(`Failed to initiate upload: ${response.statusText}`)
  }

  return await response.json()
}

/**
 * Get upload status from CDP Uploader
 * @param {string} uploadId - The upload ID
 * @param {boolean} debug - Include debug information
 * @returns {Promise<Object>} Upload status
 */
async function getUploadStatus(uploadId, debug = false) {
  const url = new URL(`${uploaderUrl}/status/${uploadId}`)
  if (debug) {
    url.searchParams.set('debug', 'true')
  }

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      'User-Agent': 'content-reviewer-frontend'
    }
  })

  if (!response.ok) {
    throw new Error(`Failed to get upload status: ${response.statusText}`)
  }

  return await response.json()
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
