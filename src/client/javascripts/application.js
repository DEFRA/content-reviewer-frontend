import {
  createAll,
  Button,
  Checkboxes,
  ErrorSummary,
  Header,
  Radios,
  SkipLink
} from 'govuk-frontend'

// Import upload handler
import './upload-handler.js'

createAll(Button)
createAll(Checkboxes)
createAll(ErrorSummary)
createAll(Header)
createAll(Radios)
createAll(SkipLink)

// Conversation management
class ConversationManager {
  constructor() {
    this.conversations = this.loadConversations()
    this.currentConversationId = null
    this.selectedFile = null // Track selected file for upload
    this.init()
  }

  init() {
    // Event listeners
    const newChatBtn = document.getElementById('newChatBtn')
    if (newChatBtn) {
      newChatBtn.addEventListener('click', () => this.createNewConversation())
    }

    // Form submit handler
    const chatForm = document.getElementById('chatForm')
    if (chatForm) {
      chatForm.addEventListener('submit', (e) => this.handleSendMessage(e))
    }

    // File upload handlers
    this.initFileUpload()

    // Load existing conversations in sidebar
    this.renderConversationList()

    // If no conversations exist, create a new one
    if (this.conversations.length === 0) {
      this.createNewConversation()
    } else {
      // Load the most recent conversation
      this.loadConversation(this.conversations[0].id)
    }
  }

  initFileUpload() {
    const attachButton = document.getElementById('attachButton')
    const fileInput = document.getElementById('fileInput')
    const removeFileBtn = document.getElementById('removeFile')

    if (!attachButton || !fileInput) {
      return
    }

    // Attach button click - open file picker
    attachButton.addEventListener('click', () => {
      fileInput.click()
    })

    // File selected
    fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0]
      if (file) {
        this.handleFileSelected(file)
      }
    })

    // Remove file button
    if (removeFileBtn) {
      removeFileBtn.addEventListener('click', () => {
        this.clearSelectedFile()
      })
    }
  }

  handleFileSelected(file) {
    // Validate file size (10MB)
    const maxSize = 10 * 1024 * 1024
    if (file.size > maxSize) {
      this.showErrorNotification(
        'File too large',
        `Maximum file size is 10MB. Your file is ${(file.size / 1024 / 1024).toFixed(2)}MB.`
      )
      this.clearSelectedFile()
      return
    }

    // Validate file type
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ]

    const extension = file.name.split('.').pop().toLowerCase()
    const allowedExtensions = ['pdf', 'doc', 'docx']

    if (
      !allowedTypes.includes(file.type) &&
      !allowedExtensions.includes(extension)
    ) {
      this.showErrorNotification(
        'Invalid file type',
        'Please upload a PDF or Word document (.pdf, .doc, .docx).'
      )
      this.clearSelectedFile()
      return
    }

    // Store file and show preview
    this.selectedFile = file
    this.showFilePreview(file)
  }

  showFilePreview(file) {
    const filePreview = document.getElementById('filePreview')
    const fileName = document.getElementById('fileName')
    const fileSize = document.getElementById('fileSize')

    if (filePreview && fileName && fileSize) {
      fileName.textContent = file.name
      fileSize.textContent = `${(file.size / 1024).toFixed(2)} KB`
      filePreview.hidden = false
    }
  }

  clearSelectedFile() {
    this.selectedFile = null
    const fileInput = document.getElementById('fileInput')
    const filePreview = document.getElementById('filePreview')

    if (fileInput) {
      fileInput.value = ''
    }
    if (filePreview) {
      filePreview.hidden = true
    }
  }

  showErrorNotification(title, message) {
    // Remove any existing error notification
    const existingError = document.getElementById('fileErrorNotification')
    if (existingError) {
      existingError.remove()
    }

    // Create error notification
    const errorDiv = document.createElement('div')
    errorDiv.id = 'fileErrorNotification'
    errorDiv.className = 'govuk-error-summary'
    errorDiv.setAttribute('role', 'alert')
    errorDiv.setAttribute('aria-labelledby', 'error-summary-title')
    errorDiv.setAttribute('data-module', 'govuk-error-summary')

    errorDiv.innerHTML = `
      <h2 class="govuk-error-summary__title" id="error-summary-title">
        ${this.escapeHtml(title)}
      </h2>
      <div class="govuk-error-summary__body">
        <p>${this.escapeHtml(message)}</p>
      </div>
    `

    // Insert at top of chat container
    const chatContainer = document.querySelector('.chat-container')
    if (chatContainer) {
      chatContainer.insertBefore(errorDiv, chatContainer.firstChild)

      // Auto-remove after 5 seconds
      setTimeout(() => {
        if (errorDiv && errorDiv.parentNode) {
          errorDiv.remove()
        }
      }, 5000)
    }
  }

  loadConversations() {
    // eslint-disable-next-line no-undef
    const stored = localStorage.getItem('conversations')
    return stored ? JSON.parse(stored) : []
  }

  saveConversations() {
    // eslint-disable-next-line no-undef
    localStorage.setItem('conversations', JSON.stringify(this.conversations))
  }

  createNewConversation() {
    // Clear the chat window
    const chatMessages = document.getElementById('chatMessages')
    if (chatMessages) {
      chatMessages.innerHTML = `
        <div class="message bot-message">
          <div class="message-content">
            <p>Hello! I'm ready to help you review content for GOV.UK compliance. You can paste any text for me to review, or ask me about specific content standards.</p>
          </div>
        </div>
      `
    }

    // Create new conversation
    const id = 'conv_' + Date.now()
    const conversation = {
      id,
      title: 'New conversation',
      messages: [],
      createdAt: new Date().toISOString()
    }

    this.conversations.unshift(conversation)
    this.currentConversationId = id
    this.saveConversations()
    this.renderConversationList()
  }

  loadConversation(id) {
    this.currentConversationId = id
    const conversation = this.conversations.find((c) => c.id === id)

    if (conversation) {
      // Clear chat messages
      const chatMessages = document.getElementById('chatMessages')
      if (chatMessages) {
        chatMessages.innerHTML = ''

        // Add welcome message if no messages
        if (conversation.messages.length === 0) {
          chatMessages.innerHTML = `
            <div class="message bot-message">
              <div class="message-content">
                <p>Hello! I'm ready to help you review content for GOV.UK compliance. You can paste any text for me to review, or ask me about specific content standards.</p>
              </div>
            </div>
          `
        } else {
          // Load conversation messages
          conversation.messages.forEach((msg) => {
            this.addMessageToUI(msg.content, msg.role)
          })
        }
      }

      // Update active state in sidebar
      this.renderConversationList()
    }
  }

  addMessageToUI(content, role, fileInfo) {
    const chatMessages = document.getElementById('chatMessages')
    if (!chatMessages) {
      return
    }

    const messageDiv = document.createElement('div')
    messageDiv.className = `message ${role}-message`

    const contentDiv = document.createElement('div')
    contentDiv.className = 'message-content'

    // Add file attachment if present
    if (fileInfo) {
      const fileExt = fileInfo.filename
        ? fileInfo.filename.split('.').pop().toLowerCase()
        : 'file'
      const isPdf = fileExt === 'pdf'
      const fileIcon = isPdf ? '📄' : '📝'

      const fileAttachment = document.createElement('div')
      fileAttachment.className = 'file-attachment'
      fileAttachment.innerHTML = `
        <div class="file-attachment-content">
          <span class="file-attachment-icon">${fileIcon}</span>
          <div class="file-attachment-details">
            <span class="file-attachment-name">${this.escapeHtml(fileInfo.filename || 'document')}</span>
            <span class="file-attachment-size">${(fileInfo.size / 1024).toFixed(2)} KB</span>
          </div>
        </div>
      `
      contentDiv.appendChild(fileAttachment)
    }

    // Add text content
    if (content) {
      const textParagraph = document.createElement('p')
      textParagraph.innerHTML = this.escapeHtml(content)
      contentDiv.appendChild(textParagraph)
    }

    messageDiv.appendChild(contentDiv)
    chatMessages.appendChild(messageDiv)
    chatMessages.scrollTop = chatMessages.scrollHeight
  }

  saveMessage(content, role, fileInfo) {
    const conversation = this.conversations.find(
      (c) => c.id === this.currentConversationId
    )
    if (conversation) {
      const message = {
        content,
        role,
        timestamp: new Date().toISOString()
      }

      // Add file info if present
      if (fileInfo) {
        message.attachment = {
          filename: fileInfo.filename,
          uploadId: fileInfo.uploadId || fileInfo.fileId,
          s3Location: fileInfo.s3Location,
          size: fileInfo.size,
          contentType: fileInfo.contentType
        }
      }

      conversation.messages.push(message)

      // Update conversation title from first user message
      if (
        role === 'user' &&
        conversation.messages.filter((m) => m.role === 'user').length === 1
      ) {
        if (fileInfo && !content) {
          conversation.title = fileInfo.filename
        } else {
          conversation.title =
            content.substring(0, 50) + (content.length > 50 ? '...' : '')
        }
      }

      this.saveConversations()
      this.renderConversationList()
    } else {
      // If no conversation exists, create one
      this.createNewConversation()
      // Retry saving the message
      const newConversation = this.conversations.find(
        (c) => c.id === this.currentConversationId
      )
      if (newConversation) {
        newConversation.messages.push({
          content,
          role,
          timestamp: new Date().toISOString()
        })
        if (role === 'user') {
          newConversation.title =
            content.substring(0, 50) + (content.length > 50 ? '...' : '')
        }
        this.saveConversations()
        this.renderConversationList()
      }
    }
  }

  async handleSendMessage(e) {
    e.preventDefault()

    const userInput = document.getElementById('userInput')
    if (!userInput) {
      return
    }

    const message = userInput.value.trim()
    const hasFile = this.selectedFile !== null

    // Must have either message or file
    if (!message && !hasFile) {
      return
    }

    // Clear input immediately
    userInput.value = ''

    // Handle file upload if file is selected
    if (hasFile) {
      try {
        const fileInfo = await this.uploadFile(this.selectedFile)

        // Add user message with file attachment
        this.addMessageToUI(message || '', 'user', fileInfo)
        this.saveMessage(message || '', 'user', fileInfo)

        // Clear file selection
        this.clearSelectedFile()

        // Redirect to polling page if we have a reviewId
        if (fileInfo.reviewId) {
          window.location.href = `/review/status-poller/${fileInfo.reviewId}`
          return
        }

        // Fallback: show typing indicator if no reviewId
        this.showTypingIndicator()
        await this.simulateAPICall(message, fileInfo)
      } catch (error) {
        console.error('File upload error:', error)
        this.addMessageToUI(
          'Sorry, the file upload failed. Please try again.',
          'bot'
        )
        this.saveMessage(
          'Sorry, the file upload failed. Please try again.',
          'bot'
        )
      }
    } else {
      // Text-only message - submit for AI review
      this.addMessageToUI(message, 'user')
      this.saveMessage(message, 'user')

      try {
        // Submit text for review
        const reviewId = await this.submitTextReview(message)

        if (reviewId) {
          // Redirect to polling page to track review progress
          window.location.href = `/review/status-poller/${reviewId}`
        } else {
          // No reviewId - fallback to placeholder
          this.showTypingIndicator()
          await this.simulateAPICall(message)
        }
      } catch (error) {
        console.error('Text review submission error:', error)
        this.hideTypingIndicator()
        this.addMessageToUI(
          'Sorry, there was an error processing your message. Please try again.',
          'bot'
        )
        this.saveMessage(
          'Sorry, there was an error processing your message. Please try again.',
          'bot'
        )
      }
    }
  }

  async uploadFile(file) {
    const formData = new FormData()
    formData.append('file', file)

    // Get backend URL from global config
    const backendUrl =
      window.APP_CONFIG?.backendApiUrl || 'http://localhost:3001'

    console.log('Uploading file to:', `${backendUrl}/api/upload`)

    const response = await fetch(`${backendUrl}/api/upload`, {
      method: 'POST',
      body: formData,
      credentials: 'include'
    })

    if (!response.ok) {
      const error = await response
        .json()
        .catch(() => ({ error: `Server error: ${response.status}` }))
      throw new Error(error.error || 'Upload failed')
    }

    const result = await response.json()
    console.log('Upload successful:', result)

    return {
      filename: result.filename || file.name,
      uploadId: result.uploadId || result.fileId,
      s3Location: result.s3Location || result.location,
      size: result.size || file.size,
      contentType: result.contentType || file.type,
      reviewId: result.reviewId // Include reviewId for redirect
    }
  }

  async submitTextReview(textContent) {
    try {
      console.log(
        'Submitting text for AI review:',
        textContent.substring(0, 100) + '...'
      )

      const response = await fetch(`${backendUrl}/api/review/text`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          content: textContent,
          title: 'Text Content'
        }),
        credentials: 'include'
      })

      if (!response.ok) {
        const error = await response
          .json()
          .catch(() => ({ message: `Server error: ${response.status}` }))
        throw new Error(error.message || 'Text review submission failed')
      }

      const result = await response.json()
      console.log('Text review submitted successfully:', result)

      return result.reviewId
    } catch (error) {
      console.error('Failed to submit text review:', error)
      throw error
    }
  }

  async simulateAPICall(message, fileInfo) {
    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, 1000))

    this.hideTypingIndicator()

    // Placeholder response
    let response = ''
    if (fileInfo) {
      response = `Thank you for your message. I received a file named "${fileInfo.filename}". This is a placeholder response. The actual AI integration will be implemented in the backend.`
    } else {
      response = `Thank you for your message. I received: "${message}". This is a placeholder response. The actual AI integration will be implemented in the backend.`
    }

    this.addMessageToUI(response, 'bot')
    this.saveMessage(response, 'bot')
  }

  showTypingIndicator() {
    const chatMessages = document.getElementById('chatMessages')
    if (!chatMessages) return

    const indicator = document.createElement('div')
    indicator.className = 'message bot-message typing-indicator-message'
    indicator.id = 'typingIndicator'
    indicator.innerHTML = `
      <div class="message-content">
        <div class="typing-indicator">
          <span></span>
          <span></span>
          <span></span>
        </div>
      </div>
    `
    chatMessages.appendChild(indicator)
    chatMessages.scrollTop = chatMessages.scrollHeight
  }

  hideTypingIndicator() {
    const indicator = document.getElementById('typingIndicator')
    if (indicator) {
      indicator.remove()
    }
  }

  renderConversationList() {
    const listContainer = document.getElementById('conversationList')
    if (!listContainer) {
      // Element not found - add visual debug
      const newChatBtn = document.getElementById('newChatBtn')
      if (newChatBtn) {
        newChatBtn.textContent = '+ ERROR: List not found'
      }
      return
    }

    listContainer.innerHTML = ''

    // Limit to last 10 conversations
    const conversationsToShow = this.conversations.slice(0, 10)

    if (conversationsToShow.length === 0) {
      // No conversations - show placeholder
      listContainer.innerHTML =
        '<p style="padding: 10px; color: #888;">No conversations yet</p>'
    }

    conversationsToShow.forEach((conv) => {
      const item = document.createElement('div')
      item.className = 'conversation-item'
      if (conv.id === this.currentConversationId) {
        item.classList.add('active')
      }

      const preview = document.createElement('p')
      preview.className = 'conversation-preview'
      preview.textContent = conv.title
      preview.title = conv.title // Show full title on hover

      item.appendChild(preview)
      item.addEventListener('click', () => this.loadConversation(conv.id))

      listContainer.appendChild(item)
    })

    // Show message if there are more than 10 conversations
    if (this.conversations.length > 10) {
      const moreItem = document.createElement('div')
      moreItem.className = 'conversation-item-info'
      const moreText = document.createElement('p')
      moreText.className = 'conversation-preview conversation-count'
      moreText.textContent = `+${this.conversations.length - 10} older conversations`
      moreItem.appendChild(moreText)
      listContainer.appendChild(moreItem)
    }

    // Visual debug - update button to show count
    const newChatBtn = document.getElementById('newChatBtn')
    if (newChatBtn && this.conversations.length > 0) {
      newChatBtn.textContent = `+ New chat (${this.conversations.length})`
    }
  }

  escapeHtml(text) {
    const div = document.createElement('div')
    div.textContent = text
    return div.innerHTML
  }
}

// Initialize conversation manager when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.conversationManager = new ConversationManager()
  })
} else {
  window.conversationManager = new ConversationManager()
}
