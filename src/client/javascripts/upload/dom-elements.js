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
}

export function getElements() {
  return elements
}

export function getFileInput() {
  return document.getElementById('file-upload')
}
