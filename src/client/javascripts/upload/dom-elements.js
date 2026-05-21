// DOM element management
const elements = {}

export function initializeElements() {
  elements.textContentInput = document.getElementById('text-content')
  elements.characterCountMessage = document.getElementById(
    'characterCountMessage'
  )
  elements.uploadButton = document.getElementById('uploadButton')
  elements.uploadProgress = document.getElementById('uploadProgress')
  elements.progressBar = document.getElementById('progressBar')
  elements.uploadStatusText = document.getElementById('uploadStatusText')
  elements.uploadProgressText = document.getElementById('uploadProgressText')
  elements.uploadError = document.getElementById('uploadError')
  elements.uploadSuccess = document.getElementById('uploadSuccess')
  elements.errorMessage = document.getElementById('errorMessage')
  elements.errorSummary = document.getElementById('errorSummary')
  elements.errorSummaryMessage = document.getElementById('errorSummaryMessage')
  elements.textFormGroup = document.getElementById('textFormGroup')
  elements.textFieldWrapper = document.getElementById('textFieldWrapper')
  elements.form = document.getElementById('uploadForm')
  // URL input elements
  elements.urlInput = document.getElementById('url-input')
  elements.urlFormGroup = document.getElementById('urlFormGroup')
  elements.urlError = document.getElementById('urlError')
  elements.urlErrorMessage = document.getElementById('urlErrorMessage')
  // Radio buttons
  elements.actionRadioUrl = document.getElementById('action-url')
  elements.actionRadioText = document.getElementById('action-text')
  elements.actionRadioDocument = document.getElementById('action-document')
  // Radio selection error elements
  elements.actionSelectionGroup = document.getElementById(
    'actionSelectionGroup'
  )
  elements.actionOptionError = document.getElementById('actionOptionError')
  elements.actionOptionErrorMessage = document.getElementById(
    'actionOptionErrorMessage'
  )
  // Document upload panel elements
  elements.documentFormGroup = document.getElementById('documentFormGroup')
  elements.documentError = document.getElementById('documentError')
  elements.documentErrorMessage = document.getElementById(
    'documentErrorMessage'
  )
  elements.fileClearButton = document.getElementById('fileClearButton')
  elements.fileBrowseButton = document.getElementById('fileBrowseButton')
}

export function getElements() {
  return elements
}

export function getFileInput() {
  return document.getElementById('file-upload')
}
