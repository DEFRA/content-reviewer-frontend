/**
 * Review Result Poller
 * Polls backend for review job results and updates the UI
 */

// Export to prevent tree-shaking
export const initReviewPoller = () => {
  // Handler initialization happens immediately
}

document.addEventListener('DOMContentLoaded', function () {
  // Get jobId from the page (set by server in a data attribute)
  const reviewContainer = document.getElementById('review-container')
  if (!reviewContainer) {
    console.log('[Review] No review container found on this page')
    return
  }

  const jobId = reviewContainer.getAttribute('data-job-id')
  if (!jobId) {
    console.error('[Review] No job ID found')
    showError('Invalid review URL - no job ID provided')
    return
  }

  console.log('[Review] Starting polling for job:', jobId)

  const maxAttempts = 60 // 2 minutes with 2 second intervals
  const pollInterval = 2000 // 2 seconds
  let attempts = 0

  const processingPanel = document.getElementById('processing-panel')
  const statusMessage = document.getElementById('status-message')
  const spinner = document.getElementById('spinner')
  const resultContainer = document.getElementById('result-container')
  const errorContainer = document.getElementById('error-container')
  const errorMessage = document.getElementById('error-message')

  // IMPORTANT: Force initial state - hide everything except processing
  if (resultContainer) {
    resultContainer.style.cssText = 'display: none !important;'
  }
  if (errorContainer) {
    errorContainer.style.cssText = 'display: none !important;'
  }
  if (processingPanel) {
    processingPanel.style.cssText = 'display: block !important;'
  }
  if (statusMessage) {
    statusMessage.style.cssText = 'display: block !important;'
  }
  if (spinner) {
    spinner.style.cssText = 'display: block !important;'
  }

  console.log('[Review] Initial UI state set - showing processing only')

  function showError(message) {
    console.error('[Review] Showing error:', message)
    if (spinner) {
      spinner.style.cssText = 'display: none !important;'
    }
    if (processingPanel) {
      processingPanel.style.cssText = 'display: none !important;'
    }
    if (statusMessage) {
      statusMessage.style.cssText = 'display: none !important;'
    }
    if (errorMessage) {
      errorMessage.textContent = message
    }
    if (errorContainer) {
      errorContainer.style.cssText = 'display: block !important;'
    }
  }

  function showResult(data) {
    console.log('[Review] Showing result:', data)
    if (spinner) {
      spinner.style.cssText = 'display: none !important;'
    }
    if (processingPanel) {
      processingPanel.style.cssText = 'display: none !important;'
    }
    if (statusMessage) {
      statusMessage.style.cssText = 'display: none !important;'
    }
    if (errorContainer) {
      errorContainer.style.cssText = 'display: none !important;'
    }

    const result = data.result

    // Populate result fields
    const filenameEl = document.getElementById('result-filename')
    const timestampEl = document.getElementById('result-timestamp')
    const reviewContentEl = document.getElementById('review-content')
    const mockWarningEl = document.getElementById('mock-warning')

    if (filenameEl) {
      filenameEl.textContent = result.filename || 'Unknown'
    }
    if (timestampEl) {
      timestampEl.textContent = new Date(
        result.processedAt || Date.now()
      ).toLocaleString()
    }
    if (reviewContentEl) {
      reviewContentEl.textContent =
        result.review || 'No review content available'
    }

    // Show mock warning if applicable
    if (result.mock && mockWarningEl) {
      mockWarningEl.style.display = 'block'
    }

    if (resultContainer) {
      resultContainer.style.cssText = 'display: block !important;'
    }
  }

  function pollResult() {
    console.log('[Review] Poll attempt', attempts + 1, 'of', maxAttempts)

    // Get backend URL from global config
    const backendUrl =
      window.APP_CONFIG?.backendApiUrl || 'http://localhost:3001'

    fetch(`${backendUrl}/api/results/${jobId}`)
      .then((response) => {
        console.log('[Review] Response status:', response.status)
        if (!response.ok) {
          throw new Error('Failed to check review status')
        }
        return response.json()
      })
      .then((data) => {
        console.log('[Review] Received data:', data)

        if (data.status === 'completed') {
          showResult(data)
        } else if (data.status === 'failed') {
          showError(
            'Review failed: ' + (data.result?.error?.message || 'Unknown error')
          )
        } else if (data.status === 'processing') {
          // Still processing
          attempts++
          if (attempts < maxAttempts) {
            console.log('[Review] Still processing, polling again in 2s...')
            setTimeout(pollResult, pollInterval)
          } else {
            showError(
              'Review processing timed out. The job may still be running in the background.'
            )
          }
        } else {
          // Unknown status
          attempts++
          if (attempts < maxAttempts) {
            console.log('[Review] Unknown status, retrying...')
            setTimeout(pollResult, pollInterval)
          } else {
            showError('Review processing timed out.')
          }
        }
      })
      .catch((error) => {
        console.error('[Review] Polling error:', error)
        showError(
          'An error occurred while checking review status: ' + error.message
        )
      })
  }

  // Start polling after a short delay
  setTimeout(pollResult, 1000)
})
