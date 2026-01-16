// Upload form handler
document.addEventListener('DOMContentLoaded', function () {
  console.log('[UPLOAD-HANDLER] Initializing upload form handler')

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

  console.log('[UPLOAD-HANDLER] DOM elements found:', {
    form: !!form,
    fileInput: !!fileInput,
    textContentInput: !!textContentInput,
    uploadButton: !!uploadButton,
    uploadProgress: !!uploadProgress
  })

  // Only run if upload form exists
  if (!form) {
    console.log(
      '[UPLOAD-HANDLER] Upload form not found, handler not initialized'
    )
    return
  }

  // Ensure error and progress are hidden on page load
  hideError()
  hideProgress()
  hideSuccess()
  console.log('[UPLOAD-HANDLER] Initial UI state reset completed')

  // ============ MUTUAL EXCLUSION LOGIC ============
  console.log('[UPLOAD-HANDLER] Setting up mutual exclusion logic')

  function updateMutualExclusion() {
    const hasFile = fileInput && fileInput.files && fileInput.files.length > 0
    const hasText = textContentInput && textContentInput.value.trim().length > 0

    console.log('[UPLOAD-HANDLER] Mutual exclusion check:', {
      hasFile,
      hasText
    })

    if (hasFile) {
      // File selected - disable and dim text input
      textContentInput.disabled = true
      textContentInput.value = ''
      textContentInput.placeholder =
        'File upload selected - text input disabled'
      textContentInput.style.opacity = '0.5'
      textContentInput.style.backgroundColor = '#f3f2f1'

      // Add visual indicator to file input group
      const fileFormGroup = document.getElementById('fileFormGroup')
      if (fileFormGroup) {
        fileFormGroup.style.border = '2px solid #1d70b8'
        fileFormGroup.style.padding = '15px'
        fileFormGroup.style.backgroundColor = '#f0f4f8'
      }

      console.log('[UPLOAD-HANDLER] Text input disabled - file selected')
    } else if (hasText) {
      // Text entered - disable and dim file input
      fileInput.disabled = true
      fileInput.style.opacity = '0.5'
      fileInput.style.backgroundColor = '#f3f2f1'

      // Add visual indicator to text input group
      const textFormGroup = document.getElementById('textFormGroup')
      if (textFormGroup) {
        textFormGroup.style.border = '2px solid #1d70b8'
        textFormGroup.style.padding = '15px'
        textFormGroup.style.backgroundColor = '#f0f4f8'
      }

      console.log('[UPLOAD-HANDLER] File input disabled - text entered')
    } else {
      // Nothing selected - enable both
      if (fileInput) {
        fileInput.disabled = false
        fileInput.style.opacity = '1'
        fileInput.style.backgroundColor = ''
      }

      if (textContentInput) {
        textContentInput.disabled = false
        textContentInput.placeholder = 'Type or paste content here...'
        textContentInput.style.opacity = '1'
        textContentInput.style.backgroundColor = ''
      }

      // Remove visual indicators
      const fileFormGroup = document.getElementById('fileFormGroup')
      const textFormGroup = document.getElementById('textFormGroup')
      if (fileFormGroup) {
        fileFormGroup.style.border = ''
        fileFormGroup.style.padding = ''
        fileFormGroup.style.backgroundColor = ''
      }
      if (textFormGroup) {
        textFormGroup.style.border = ''
        textFormGroup.style.padding = ''
        textFormGroup.style.backgroundColor = ''
      }

      console.log('[UPLOAD-HANDLER] Both inputs enabled - nothing selected')
    }
  }

  // File input change handler
  if (fileInput && textContentInput) {
    fileInput.addEventListener('change', () => {
      console.log(
        '[UPLOAD-HANDLER] File input changed, files count:',
        fileInput.files.length
      )
      updateMutualExclusion()
    })

    // Text input change handler
    textContentInput.addEventListener('input', () => {
      console.log(
        '[UPLOAD-HANDLER] Text input changed, length:',
        textContentInput.value.trim().length
      )
      updateMutualExclusion()
    })

    // Initial state
    updateMutualExclusion()
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault()
    console.log('[UPLOAD-HANDLER] Form submission started')

    // Reset UI state
    hideError()
    hideSuccess()
    hideProgress()

    const file = fileInput.files[0]
    const textContent = document.getElementById('text-content')?.value.trim()

    console.log('[UPLOAD-HANDLER] Submission data:', {
      hasFile: !!file,
      hasTextContent: !!textContent,
      textLength: textContent?.length || 0,
      fileName: file?.name || null,
      fileSize: file ? `${(file.size / 1024 / 1024).toFixed(2)}MB` : null,
      fileType: file?.type || null
    })

    // Check if either file or text content is provided
    if (!file && !textContent) {
      console.error(
        '[UPLOAD-HANDLER] Validation failed: No file or text content provided'
      )
      showError('Please either upload a file or enter text content to review')
      return
    }

    // If text content is provided, handle text review
    if (textContent && !file) {
      console.log('[UPLOAD-HANDLER] Routing to text review handler')
      await handleTextReview(textContent)
      return
    }

    console.log('[UPLOAD-HANDLER] Starting file upload validation')

    // Validate file size (10MB)
    const maxSize = 10 * 1024 * 1024
    if (file.size > maxSize) {
      const fileSizeMB = (file.size / 1024 / 1024).toFixed(2)
      console.error('[UPLOAD-HANDLER] File size validation failed:', {
        fileSize: `${fileSizeMB}MB`,
        maxSize: '10MB'
      })
      showError(
        `File too large. Maximum size is 10MB. Your file is ${fileSizeMB}MB`
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
      console.error('[UPLOAD-HANDLER] File type validation failed:', {
        fileName: file.name,
        fileType: file.type,
        allowedTypes
      })
      showError('Invalid file type. Please upload a PDF or Word document')
      return
    }

    console.log('[UPLOAD-HANDLER] File validation passed, starting upload')

    try {
      // Start upload
      uploadButton.disabled = true
      showProgress('Preparing upload...', 0)
      console.log('[UPLOAD-HANDLER] Upload process started')

      const formData = new FormData()
      formData.append('file', file)

      // Uploading
      showProgress('Uploading to server...', 30)
      console.log('[UPLOAD-HANDLER] Making API request to /api/upload')

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
        credentials: 'include'
      })

      // Processing
      showProgress('Processing upload...', 70)
      console.log('[UPLOAD-HANDLER] Upload response received:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok
      })

      if (!response.ok) {
        const error = await response
          .json()
          .catch(() => ({ error: `Server error: ${response.status}` }))
        console.error('[UPLOAD-HANDLER] Upload request failed:', {
          status: response.status,
          error: error.error
        })
        throw new Error(error.error || 'Upload failed')
      }

      const result = await response.json()
      console.log('[UPLOAD-HANDLER] Upload successful, result:', result)

      // Complete
      showProgress('Upload complete!', 100)

      // Clear form state first
      fileInput.value = ''
      updateMutualExclusion()

      // Redirect to polling page after a brief moment or refresh page
      setTimeout(() => {
        if (result.reviewId) {
          console.log(
            '[UPLOAD-HANDLER] Redirecting to status poller:',
            result.reviewId
          )
          window.location.href = `/review/status-poller/${result.reviewId}`
        } else {
          console.log(
            '[UPLOAD-HANDLER] No reviewId in response, refreshing page to show success'
          )
          // Refresh the entire page to show updated review history
          window.location.reload()
        }
      }, 1500)
    } catch (error) {
      console.error('[UPLOAD-HANDLER] Upload failed:', {
        message: error.message,
        stack: error.stack
      })
      showError(error.message || 'Upload failed. Please try again.')
      uploadButton.disabled = false
      textContentInput.disabled = false
      textContentInput.placeholder = 'Type or paste content here...'
      textContentInput.style.opacity = '1'
      hideProgress()
    }
  })

  function showError(message) {
    console.log('[UPLOAD-HANDLER] Showing error:', message)
    errorMessage.textContent = message
    uploadError.hidden = false
    uploadError.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }

  function hideError() {
    console.log('[UPLOAD-HANDLER] Hiding error message')
    uploadError.hidden = true
  }

  function hideSuccess() {
    console.log('[UPLOAD-HANDLER] Hiding success message')
    uploadSuccess.hidden = true
  }

  function showProgress(statusText, percentage) {
    console.log('[UPLOAD-HANDLER] Progress update:', { statusText, percentage })
    uploadStatusText.textContent = statusText
    uploadProgressText.textContent = percentage + '%'
    // Round to nearest 10 for data attribute
    const roundedPercentage = Math.round(percentage / 10) * 10
    progressBar.setAttribute('data-progress', roundedPercentage.toString())
    uploadProgress.hidden = false
  }

  function hideProgress() {
    console.log('[UPLOAD-HANDLER] Hiding progress indicator')
    uploadProgress.hidden = true
    progressBar.setAttribute('data-progress', '0')
  }

  // Handle text content review
  async function handleTextReview(textContent) {
    console.log('[UPLOAD-HANDLER] Starting text review process')

    try {
      uploadButton.disabled = true
      showProgress('Preparing review...', 0)

      // Validate text content length (max 50,000 characters)
      const maxLength = 50000
      console.log('[UPLOAD-HANDLER] Validating text length:', {
        length: textContent.length,
        maxLength
      })

      if (textContent.length > maxLength) {
        console.error('[UPLOAD-HANDLER] Text length validation failed:', {
          length: textContent.length,
          maxLength
        })
        throw new Error(
          `Text content too long. Maximum ${maxLength} characters. Your content has ${textContent.length} characters.`
        )
      }

      // Minimum content check
      if (textContent.length < 10) {
        console.error(
          '[UPLOAD-HANDLER] Text length too short:',
          textContent.length
        )
        throw new Error(
          'Text content too short. Please provide at least 10 characters.'
        )
      }

      showProgress('Submitting for review...', 30)

      // Use first 10 characters of text as title (or less if shorter)
      const title =
        textContent.substring(0, 10).trim() +
        (textContent.length > 10 ? '...' : '')

      console.log('[UPLOAD-HANDLER] Making API request to /api/review-text:', {
        titlePreview: title,
        contentLength: textContent.length
      })

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
      console.log('[UPLOAD-HANDLER] Text review response received:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok
      })

      if (!response.ok) {
        const error = await response
          .json()
          .catch(() => ({ error: `Server error: ${response.status}` }))
        console.error('[UPLOAD-HANDLER] Text review request failed:', {
          status: response.status,
          error: error.error
        })
        throw new Error(error.error || 'Text review failed')
      }

      const result = await response.json()
      console.log('[UPLOAD-HANDLER] Text review response:', result)

      if (!result.success) {
        console.error(
          '[UPLOAD-HANDLER] Text review marked as failed:',
          result.error
        )
        throw new Error(result.error || 'Text review failed')
      }

      showProgress('Review submitted!', 100)

      // Clear form state
      textContentInput.value = ''
      updateMutualExclusion()

      // Redirect to polling page
      setTimeout(() => {
        if (result.reviewId) {
          console.log(
            '[UPLOAD-HANDLER] Redirecting to text review status poller:',
            result.reviewId
          )
          window.location.href = `/review/status-poller/${result.reviewId}`
        } else {
          console.log(
            '[UPLOAD-HANDLER] No reviewId in text review response, refreshing page'
          )
          // Refresh the entire page to show updated review history
          window.location.reload()
        }
      }, 1500)
    } catch (error) {
      console.error('[UPLOAD-HANDLER] Text review failed:', {
        message: error.message,
        stack: error.stack
      })
      showError(error.message || 'Text review failed. Please try again.')
      uploadButton.disabled = false
      fileInput.disabled = false
      fileInput.style.opacity = '1'
      hideProgress()
    }
  }
})
