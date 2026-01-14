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

      const response = await fetch('http://localhost:3001/api/upload', {
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
        if (result.reviewId) {
          window.location.href = `/review/status-poller/${result.reviewId}`
        } else {
          // Fallback: show success message if no reviewId
          hideProgress()
          showSuccess('File uploaded successfully')
          fileInput.value = ''
          uploadButton.disabled = false
        }
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
