// Upload form handler
document.addEventListener('DOMContentLoaded', function () {
  console.log('[UPLOAD-HANDLER] Initializing upload form handler')

  const textContentInput = document.getElementById('text-content')
  const uploadButton = document.getElementById('uploadButton')
  const uploadProgress = document.getElementById('uploadProgress')
  const progressBar = document.getElementById('progressBar')
  const uploadStatusText = document.getElementById('uploadStatusText')
  const uploadProgressText = document.getElementById('uploadProgressText')
  const uploadError = document.getElementById('uploadError')
  const uploadSuccess = document.getElementById('uploadSuccess')
  const errorMessage = document.getElementById('errorMessage')
  const form = document.getElementById('uploadForm')

  // Use function to get current file input (since it may be recreated)
  const getFileInput = () => document.getElementById('file-upload')

  // Only run if upload form exists
  if (!form) {
    return
  }

  // Ensure error and progress are hidden on page load
  hideError()
  hideProgress()
  hideSuccess()

  // ============ MUTUAL EXCLUSION LOGIC ============
  // Styles for mutual exclusion are now in utilities.scss - no need to inject dynamically

  // Add clear buttons for both inputs for better UX
  function addClearButton(input, label, onClear) {
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.textContent = label
    btn.className =
      'govuk-button govuk-button--secondary govuk-!-margin-left-2 app-clear-button'
    btn.addEventListener('click', onClear)
    input.parentNode.appendChild(btn)
    return btn
  }

  let fileClearBtn, textClearBtn

  function initializeFileInput() {
    const fileInput = getFileInput()
    if (!fileInput) return

    // Remove existing clear button if present
    if (fileClearBtn && fileClearBtn.parentNode) {
      fileClearBtn.parentNode.removeChild(fileClearBtn)
    }

    // Add clear button
    fileClearBtn = addClearButton(fileInput, 'Clear File', () => {
      const fileInput = getFileInput()
      if (fileInput) {
        fileInput.value = ''
        fileInput.disabled = false
      }
      updateMutualExclusion()
    })

    // Add event listeners
    fileInput.addEventListener('change', onFileInputChange)
    fileInput.addEventListener('input', onFileInputChange)
  }

  // Initialize file input
  initializeFileInput()

  if (textContentInput) {
    textClearBtn = addClearButton(textContentInput, 'Clear Text', () => {
      textContentInput.value = ''
      textContentInput.disabled = false
      updateMutualExclusion()
    })
  }

  function updateMutualExclusion() {
    const fileInput = getFileInput()
    const hasFile = fileInput && fileInput.files && fileInput.files.length > 0
    const hasText = textContentInput && textContentInput.value.trim().length > 0
    const fileFormGroup = document.getElementById('fileFormGroup')
    const textFormGroup = document.getElementById('textFormGroup')

    if (hasFile) {
      // File selected: clear and disable textarea
      if (textFormGroup) {
        textFormGroup.classList.add('app-disabled')
        textFormGroup.setAttribute('aria-disabled', 'true')
        textFormGroup.classList.remove('app-highlight')
      }
      if (textContentInput) {
        textContentInput.value = ''
        textContentInput.disabled = true
        textContentInput.placeholder =
          'File upload selected - text input disabled'
      }
      if (fileFormGroup) {
        fileFormGroup.classList.remove('app-disabled')
        fileFormGroup.classList.add('app-highlight')
        fileFormGroup.removeAttribute('aria-disabled')
      }
      if (fileInput) fileInput.disabled = false
      if (fileClearBtn) fileClearBtn.disabled = false
      if (textClearBtn) textClearBtn.disabled = true
    } else if (hasText) {
      // Text entered: clear and disable file input
      if (fileFormGroup) {
        fileFormGroup.classList.add('app-disabled')
        fileFormGroup.setAttribute('aria-disabled', 'true')
        fileFormGroup.classList.remove('app-highlight')
      }
      if (fileInput) {
        fileInput.value = ''
        fileInput.disabled = true
      }
      if (textFormGroup) {
        textFormGroup.classList.remove('app-disabled')
        textFormGroup.classList.add('app-highlight')
        textFormGroup.removeAttribute('aria-disabled')
      }
      if (textContentInput) {
        textContentInput.disabled = false
        textContentInput.placeholder = 'Type or paste content here...'
      }
      if (fileClearBtn) fileClearBtn.disabled = true
      if (textClearBtn) textClearBtn.disabled = false
    } else {
      // Nothing selected: enable both
      if (fileFormGroup) {
        fileFormGroup.classList.remove('app-disabled', 'app-highlight')
        fileFormGroup.removeAttribute('aria-disabled')
      }
      if (textFormGroup) {
        textFormGroup.classList.remove('app-disabled', 'app-highlight')
        textFormGroup.removeAttribute('aria-disabled')
      }
      if (fileInput) fileInput.disabled = false
      if (textContentInput) {
        textContentInput.disabled = false
        textContentInput.placeholder = 'Type or paste content here...'
      }
      if (fileClearBtn) fileClearBtn.disabled = false
      if (textClearBtn) textClearBtn.disabled = false
    }
  }

  function onFileInputChange(e) {
    // Use setTimeout to ensure browser has updated the file input state
    setTimeout(() => {
      updateMutualExclusion()
    }, 10)
  }

  function onTextInputChange() {
    updateMutualExclusion()
  }

  // Add robust event listeners for text input
  if (textContentInput) {
    textContentInput.addEventListener('input', onTextInputChange)
    textContentInput.addEventListener('change', onTextInputChange)
    textContentInput.addEventListener('paste', () => {
      setTimeout(onTextInputChange, 10)
    })

    // Initial state
    updateMutualExclusion()
  }

  // Initial state
  updateMutualExclusion()

  form.addEventListener('submit', async (e) => {
    e.preventDefault()

    console.log('[UPLOAD-HANDLER] Form submitted')

    hideError()
    hideSuccess()
    hideProgress()

    // Always re-check mutual exclusion before submit
    updateMutualExclusion()

    const fileInput = getFileInput()
    const file = fileInput?.files?.[0]
    const textContent = textContentInput?.value.trim()

    // Enforce: only one input can be set
    if ((file && textContent) || (!file && !textContent)) {
      showError('Please either upload a file or enter text content, not both.')
      return
    }

    if (file && !textContent) {
      const maxSize = 10 * 1024 * 1024
      if (file.size > maxSize) {
        const fileSizeMB = (file.size / 1024 / 1024).toFixed(2)
        showError(
          `File too large. Maximum size is 10MB. Your file is ${fileSizeMB}MB`
        )
        return
      }
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
        uploadButton.disabled = true
        showProgress('Preparing upload...', 0)

        console.log('[UPLOAD-HANDLER] Starting file upload:', file.name)

        const formData = new FormData()
        formData.append('file', file)
        showProgress('Uploading to server...', 30)

        const response = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
          credentials: 'include'
        })

        showProgress('Processing upload...', 70)
        if (!response.ok) {
          const error = await response
            .json()
            .catch(() => ({ error: `Server error: ${response.status}` }))
          throw new Error(error.error || 'Upload failed')
        }
        await response.json()

        console.log('[UPLOAD-HANDLER] Upload successful')

        showProgress('Upload complete!', 100)
        if (fileInput) fileInput.value = ''
        updateMutualExclusion()
        setTimeout(() => {
          window.location.reload()
        }, 1500)
      } catch (error) {
        console.error('[UPLOAD-HANDLER] Upload error', error)
        showError(error.message || 'Upload failed. Please try again.')
        uploadButton.disabled = false
        if (textContentInput) textContentInput.disabled = false
        updateMutualExclusion()
        hideProgress()
      }
    } else if (textContent && !file) {
      await handleTextReview(textContent)
    } else {
      showError('Please either upload a file or enter text content to review')
    }
  })

  function showError(message) {
    if (errorMessage) errorMessage.textContent = message
    if (uploadError) {
      uploadError.hidden = false
      uploadError.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }
  function hideError() {
    if (uploadError) uploadError.hidden = true
  }
  function hideSuccess() {
    if (uploadSuccess) uploadSuccess.hidden = true
  }
  function showProgress(statusText, percentage) {
    if (uploadStatusText) uploadStatusText.textContent = statusText
    if (uploadProgressText) uploadProgressText.textContent = percentage + '%'
    const roundedPercentage = Math.round(percentage / 10) * 10
    if (progressBar) {
      progressBar.setAttribute('data-progress', roundedPercentage.toString())
    }
    if (uploadProgress) uploadProgress.hidden = false
  }
  function hideProgress() {
    if (uploadProgress) uploadProgress.hidden = true
    if (progressBar) progressBar.setAttribute('data-progress', '0')
  }

  async function handleTextReview(textContent) {
    try {
      uploadButton.disabled = true
      showProgress('Preparing review...', 0)

      console.log('[UPLOAD-HANDLER] Starting text review')

      const maxLength = 50000
      if (textContent.length > maxLength) {
        throw new Error(
          `Text content too long. Maximum ${maxLength} characters. Your content has ${textContent.length} characters.`
        )
      }
      if (textContent.length < 10) {
        throw new Error(
          'Text content too short. Please provide at least 10 characters.'
        )
      }
      showProgress('Submitting for review...', 30)
      // Extract first 3 words for title, with fallback
      const words = textContent
        .trim()
        .split(/\s+/)
        .filter((w) => w.length > 0)
      const title =
        words.length > 0
          ? words.slice(0, 3).join(' ').substring(0, 50) + '...'
          : 'Text Content'
      const response = await fetch('/api/review/text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ textContent, title }),
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

      console.log('[UPLOAD-HANDLER] Text review successful')

      showProgress('Review submitted!', 100)
      textContentInput.value = ''
      updateMutualExclusion()
      setTimeout(() => {
        window.location.reload()
      }, 1500)
    } catch (error) {
      console.error('[UPLOAD-HANDLER] Text review error', error)
      showError(error.message || 'Text review failed. Please try again.')
      uploadButton.disabled = false
      const fileInput = getFileInput()
      if (fileInput) fileInput.disabled = false
      updateMutualExclusion()
      hideProgress()
    }
  }
})
