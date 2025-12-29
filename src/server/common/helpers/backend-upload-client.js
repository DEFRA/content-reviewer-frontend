/**
 * Backend Upload Client
 * Handles file uploads to the backend API
 */

/**
 * Upload file to backend
 * @param {File} file - File object from file input
 * @returns {Promise<Object>} Upload result
 */
async function uploadFile(file) {
  const formData = new FormData()
  formData.append('file', file)

  const response = await fetch('http://localhost:3001/api/upload', {
    method: 'POST',
    body: formData,
    credentials: 'include'
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Upload failed')
  }

  return await response.json()
}

/**
 * Check upload service health
 * @returns {Promise<Object>} Health status
 */
async function checkUploadHealth() {
  const response = await fetch('http://localhost:3001/api/upload/health', {
    method: 'GET',
    credentials: 'include'
  })

  if (!response.ok) {
    throw new Error('Upload service unavailable')
  }

  return await response.json()
}

export { uploadFile, checkUploadHealth }
