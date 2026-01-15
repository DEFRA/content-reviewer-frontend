// Upload form handler
document.addEventListener('DOMContentLoaded', function () {
  const form = document.getElementById('uploadForm')
  const fileInput = document.getElementById('file-upload')
  const uploadButton = document.getElementById('uploadButton')
  const uploadProgress = document.getElementById('uploadProgress')
  const progressBar = document.getElementById('progressBar')
  const uploadStatusText = document.getElementById('uploadStatusText')
  const uploadProgressText = document.getElementById('uploadProgressText')
  const uploadError = document.getElementById('uploadError')
  const uploadSuccess = document.getElementById('uploadSuccess')
  const errorMessage = document.getElementById('errorMessage')
  const successMessage = document.getElementById('successMessage')

  // Only run if upload form exists
  if (!form) {
    return
  }

  // Ensure error and progress are hidden on page load
  hideError()
  hideProgress()
  hideSuccess()

  form.addEventListener('submit', async (e) => {
    e.preventDefault()

    // Reset UI state
    hideError()
    hideSuccess()
    hideProgress()

    const file = fileInput.files[0]
    if (!file) {
      showError('Please select a file to upload')
      return
    }

    // Validate file size (10MB)
    const maxSize = 10 * 1024 * 1024
    if (file.size > maxSize) {
      showError(
        `File too large. Maximum size is 10MB. Your file is ${(file.size / 1024 / 1024).toFixed(2)}MB`
      )
      return
    }

    // Validate file type
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ]

    if (
      !allowedTypes.includes(file.type) &&
      !file.name.match(/\.(pdf|doc|docx)$/i)
    ) {
      showError('Invalid file type. Please upload a PDF or Word document')
      return
    }

    try {
      // Start upload
      uploadButton.disabled = true
      showProgress('Preparing upload...', 0)

      const formData = new FormData()
      formData.append('file', file)

      // Uploading
      showProgress('Uploading to server...', 30)

      // Get backend URL from global config
      const backendUrl =
        window.APP_CONFIG?.backendApiUrl || 'http://localhost:3001'

      const response = await fetch(`${backendUrl}/api/upload`, {
        method: 'POST',
        body: formData,
        credentials: 'include'
      })

      // Processing
      showProgress('Processing upload...', 70)

      if (!response.ok) {
        const error = await response
          .json()
          .catch(() => ({ error: `Server error: ${response.status}` }))
        throw new Error(error.error || 'Upload failed')
      }

      const result = await response.json()

      // Complete
      showProgress('Upload complete!', 100)

      // Redirect to polling page after a brief moment
      setTimeout(() => {
        hideProgress()

        // Build success message with available data
        let successMsg = `<strong>${result.filename || result.fileName || 'File'}</strong> `
        if (result.size) {
          successMsg += `(${(result.size / 1024).toFixed(2)} KB) `
        }
        successMsg += `has been uploaded successfully to S3.`

        if (result.uploadId || result.fileId || result.id) {
          successMsg += `<br><strong>File ID:</strong> ${result.uploadId || result.fileId || result.id}`
        }

        if (result.s3Location || result.s3Bucket || result.location) {
          const location =
            result.s3Location ||
            result.location ||
            (result.s3Bucket && result.s3Key
              ? result.s3Bucket + '/' + result.s3Key
              : '')
          if (location) {
            successMsg += `<br><strong>Storage:</strong> ${location}`
          }
        }

        showSuccess(successMsg)

        // Reset form for another upload
        fileInput.value = ''
        uploadButton.disabled = false
      }, 800)
    } catch (error) {
      showError(error.message || 'Upload failed. Please try again.')
      uploadButton.disabled = false
      hideProgress()
    }
  })

  function showError(message) {
    errorMessage.textContent = message
    uploadError.hidden = false
    uploadError.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }

  function hideError() {
    uploadError.hidden = true
  }

  function showSuccess(message) {
    successMessage.innerHTML = message
    uploadSuccess.hidden = false
    uploadSuccess.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  function hideSuccess() {
    uploadSuccess.hidden = true
  }

  function showProgress(statusText, percentage) {
    uploadStatusText.textContent = statusText
    uploadProgressText.textContent = percentage + '%'
    // Round to nearest 10 for data attribute
    const roundedPercentage = Math.round(percentage / 10) * 10
    progressBar.setAttribute('data-progress', roundedPercentage.toString())
    uploadProgress.hidden = false
  }

  function hideProgress() {
    uploadProgress.hidden = true
    progressBar.setAttribute('data-progress', '0')
  }
})
