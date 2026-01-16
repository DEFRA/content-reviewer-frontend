// Upload form handler
document.addEventListener('DOMContentLoaded', function () {
  const form = document.getElementById('uploadForm')
  const fileInput = document.getElementById('file-upload')
  const textContentInput = document.getElementById('text-content')
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

  // ============ MUTUAL EXCLUSION LOGIC ============
  // Disable text input when file is selected
  if (fileInput && textContentInput) {
    fileInput.addEventListener('change', () => {
      if (fileInput.files.length > 0) {
        textContentInput.disabled = true
        textContentInput.placeholder =
          'File upload selected - text input disabled'
        textContentInput.style.opacity = '0.6'
      } else {
        textContentInput.disabled = false
        textContentInput.placeholder = 'Type or paste content here...'
        textContentInput.style.opacity = '1'
      }
    })

    // Disable file input when user types text
    textContentInput.addEventListener('input', () => {
      if (textContentInput.value.trim().length > 0) {
        fileInput.disabled = true
        fileInput.style.opacity = '0.6'
      } else {
        fileInput.disabled = false
        fileInput.style.opacity = '1'
      }
    })
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault()

    // Reset UI state
    hideError()
    hideSuccess()
    hideProgress()

    const file = fileInput.files[0]
    const textContent = document.getElementById('text-content')?.value.trim()

    // Check if either file or text content is provided
    if (!file && !textContent) {
      showError('Please either upload a file or enter text content to review')
      return
    }

    // If text content is provided, handle text review
    if (textContent && !file) {
      await handleTextReview(textContent)
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

      const response = await fetch('/api/upload', {
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
          textContentInput.disabled = false
          textContentInput.placeholder = 'Type or paste content here...'
          textContentInput.style.opacity = '1'
          uploadButton.disabled = false
        }
      }, 800)
    } catch (error) {
      showError(error.message || 'Upload failed. Please try again.')
      uploadButton.disabled = false
      textContentInput.disabled = false
      textContentInput.placeholder = 'Type or paste content here...'
      textContentInput.style.opacity = '1'
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

  // Handle text content review
  async function handleTextReview(textContent) {
    try {
      uploadButton.disabled = true
      showProgress('Preparing review...', 0)

      // Validate text content length (max 50,000 characters)
      const maxLength = 50000
      if (textContent.length > maxLength) {
        throw new Error(
          `Text content too long. Maximum ${maxLength} characters. Your content has ${textContent.length} characters.`
        )
      }

      // Minimum content check
      if (textContent.length < 10) {
        throw new Error(
          'Text content too short. Please provide at least 10 characters.'
        )
      }

      showProgress('Submitting for review...', 30)

      // Use first 10 characters of text as title (or less if shorter)
      const title =
        textContent.substring(0, 10).trim() +
        (textContent.length > 10 ? '...' : '')

      const response = await fetch('/api/review-text', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          content: textContent,
          title
        }),
        credentials: 'include'
      })

      showProgress('Processing review...', 70)

      if (!response.ok) {
        const error = await response
          .json()
          .catch(() => ({ error: `Server error: ${response.status}` }))
        throw new Error(error.error || 'Text review failed')
      }

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || 'Text review failed')
      }

      showProgress('Review submitted!', 100)

      // Redirect to polling page
      setTimeout(() => {
        if (result.reviewId) {
          window.location.href = `/review/status-poller/${result.reviewId}`
        } else {
          hideProgress()
          showSuccess('Text submitted for review successfully')
          textContentInput.value = ''
          fileInput.disabled = false
          fileInput.style.opacity = '1'
          uploadButton.disabled = false
        }
      }, 800)
    } catch (error) {
      showError(error.message || 'Text review failed. Please try again.')
      uploadButton.disabled = false
      fileInput.disabled = false
      fileInput.style.opacity = '1'
      hideProgress()
    }
  }
})
