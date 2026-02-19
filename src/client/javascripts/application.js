import {
  createAll,
  Accordion,
  Button,
  Checkboxes,
  ErrorSummary,
  Header,
  Radios,
  SkipLink
} from 'govuk-frontend'

// Import handlers
import './upload-handler.js'
import './cookie-banner.js'
import { FileUploadHandler } from './file-upload-handler.js'
import { ConversationStorage } from './conversation-storage.js'
import { ApiService } from './api-service.js'
import { UiHelper } from './ui-helper.js'

// Initialize GOV.UK Frontend components
createAll(Accordion)
createAll(Button)
createAll(Checkboxes)
createAll(ErrorSummary)
createAll(Header)
createAll(Radios)
createAll(SkipLink)

// Constants
const CONVERSATION_TITLE_MAX_LENGTH = 50
const SIMULATE_API_DELAY_MS = 1000
const MAX_CONVERSATIONS_TO_DISPLAY = 10

// Conversation management
class ConversationManager {
  constructor() {
    this.conversations = ConversationStorage.loadConversations()
    this.currentConversationId = null
    this.fileUploadHandler = null
    this.init()
  }

  init() {
    this.setupEventListeners()
    this.initializeFileUpload()
    this.renderConversationList()
    this.loadOrCreateConversation()
  }

  setupEventListeners() {
    const newChatBtn = document.getElementById('newChatBtn')
    if (newChatBtn) {
      newChatBtn.addEventListener('click', () => this.createNewConversation())
    }

    const chatForm = document.getElementById('chatForm')
    if (chatForm) {
      chatForm.addEventListener('submit', (e) => this.handleSendMessage(e))
    }
  }

  initializeFileUpload() {
    this.fileUploadHandler = new FileUploadHandler(null, (title, message) =>
      UiHelper.showErrorNotification(title, message)
    )
  }

  loadOrCreateConversation() {
    if (this.conversations.length === 0) {
      this.createNewConversation()
    } else {
      this.loadConversation(this.conversations[0].id)
    }
  }

  createNewConversation() {
    this.clearChatMessages()
    this.showWelcomeMessage()

    const conversation = this.buildNewConversation()
    this.conversations.unshift(conversation)
    this.currentConversationId = conversation.id

    ConversationStorage.saveConversations(this.conversations)
    this.renderConversationList()
  }

  buildNewConversation() {
    const id = `conv_${Date.now()}`
    return {
      id,
      title: 'New conversation',
      messages: [],
      createdAt: new Date().toISOString()
    }
  }

  clearChatMessages() {
    const chatMessages = document.getElementById('chatMessages')
    if (chatMessages) {
      chatMessages.innerHTML = ''
    }
  }

  showWelcomeMessage() {
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
  }

  loadConversation(id) {
    this.currentConversationId = id
    const conversation = this.conversations.find((c) => c.id === id)

    if (!conversation) {
      return
    }

    this.clearChatMessages()

    if (conversation.messages.length === 0) {
      this.showWelcomeMessage()
    } else {
      this.renderConversationMessages(conversation.messages)
    }

    this.renderConversationList()
  }

  renderConversationMessages(messages) {
    messages.forEach((msg) => {
      this.addMessageToUI(msg.content, msg.role, msg.attachment)
    })
  }

  addMessageToUI(content, role, fileInfo) {
    const chatMessages = document.getElementById('chatMessages')
    if (!chatMessages) {
      return
    }

    const messageDiv = this.createMessageElement(content, role, fileInfo)
    chatMessages.appendChild(messageDiv)
    UiHelper.scrollToBottom('chatMessages')
  }

  createMessageElement(content, role, fileInfo) {
    const messageDiv = document.createElement('div')
    messageDiv.className = `message ${role}-message`

    const contentDiv = document.createElement('div')
    contentDiv.className = 'message-content'

    if (fileInfo) {
      contentDiv.appendChild(this.createFileAttachment(fileInfo))
    }

    if (content) {
      const textParagraph = document.createElement('p')
      textParagraph.innerHTML = UiHelper.escapeHtml(content)
      contentDiv.appendChild(textParagraph)
    }

    messageDiv.appendChild(contentDiv)
    return messageDiv
  }

  createFileAttachment(fileInfo) {
    const extension = fileInfo.filename
      ? fileInfo.filename.split('.').pop().toLowerCase()
      : 'file'
    const isPdf = extension === 'pdf'
    const fileIcon = isPdf ? '📄' : '📝'

    const fileAttachment = document.createElement('div')
    fileAttachment.className = 'file-attachment'
    fileAttachment.innerHTML = `
      <div class="file-attachment-content">
        <span class="file-attachment-icon">${fileIcon}</span>
        <div class="file-attachment-details">
          <span class="file-attachment-name">${UiHelper.escapeHtml(fileInfo.filename || 'document')}</span>
          <span class="file-attachment-size">${(fileInfo.size / 1024).toFixed(2)} KB</span>
        </div>
      </div>
    `
    return fileAttachment
  }

  saveMessage(content, role, fileInfo) {
    const conversation = this.getOrCreateConversation()
    if (!conversation) {
      return
    }

    const message = this.createMessage(content, role, fileInfo)
    conversation.messages.push(message)

    this.updateConversationTitleIfNeeded(conversation, content, role)
    ConversationStorage.saveConversations(this.conversations)
    this.renderConversationList()
  }

  getOrCreateConversation() {
    let conversation = this.conversations.find(
      (c) => c.id === this.currentConversationId
    )

    if (!conversation) {
      this.createNewConversation()
      conversation = this.conversations.find(
        (c) => c.id === this.currentConversationId
      )
    }

    return conversation
  }

  createMessage(content, role, fileInfo) {
    const message = {
      content,
      role,
      timestamp: new Date().toISOString()
    }

    if (fileInfo) {
      message.attachment = {
        filename: fileInfo.filename,
        uploadId: fileInfo.uploadId || fileInfo.fileId,
        s3Location: fileInfo.s3Location,
        size: fileInfo.size,
        contentType: fileInfo.contentType
      }
    }

    return message
  }

  updateConversationTitleIfNeeded(conversation, content, role) {
    const isFirstUserMessage =
      role === 'user' &&
      conversation.messages.filter((m) => m.role === 'user').length === 1

    if (isFirstUserMessage && content) {
      conversation.title = this.truncateTitle(content)
    }
  }

  truncateTitle(content) {
    if (content.length <= CONVERSATION_TITLE_MAX_LENGTH) {
      return content
    }
    return `${content.substring(0, CONVERSATION_TITLE_MAX_LENGTH)}...`
  }

  async handleSendMessage(e) {
    e.preventDefault()

    const userInput = document.getElementById('userInput')
    if (!userInput) {
      return
    }

    const message = userInput.value.trim()
    const hasFile = this.fileUploadHandler.hasSelectedFile()

    if (!message && !hasFile) {
      return
    }

    userInput.value = ''

    if (hasFile) {
      await this.handleFileUpload(message)
    } else {
      await this.handleTextReview(message)
    }
  }

  async handleFileUpload(message) {
    try {
      const file = this.fileUploadHandler.getSelectedFile()
      const fileInfo = await ApiService.uploadFile(file)

      this.addMessageToUI(message || '', 'user', fileInfo)
      this.saveMessage(message || '', 'user', fileInfo)

      this.fileUploadHandler.clearSelectedFile()

      if (fileInfo.reviewId) {
        globalThis.location.href = `/review/status-poller/${fileInfo.reviewId}`
        return
      }

      UiHelper.showTypingIndicator()
      await this.simulateAPICall(message, fileInfo)
    } catch (error) {
      console.error('File upload error:', error)
      this.showErrorMessage('Sorry, the file upload failed. Please try again.')
    }
  }

  async handleTextReview(message) {
    this.addMessageToUI(message, 'user')
    this.saveMessage(message, 'user')

    try {
      const reviewId = await ApiService.submitTextReview(message)

      if (reviewId) {
        globalThis.location.href = `/review/status-poller/${reviewId}`
      } else {
        UiHelper.showTypingIndicator()
        await this.simulateAPICall(message)
      }
    } catch (error) {
      console.error('Text review submission error:', error)
      UiHelper.hideTypingIndicator()
      this.showErrorMessage(
        'Sorry, there was an error processing your message. Please try again.'
      )
    }
  }

  showErrorMessage(errorText) {
    this.addMessageToUI(errorText, 'bot')
    this.saveMessage(errorText, 'bot')
  }

  async simulateAPICall(message, fileInfo) {
    await new Promise((resolve) => setTimeout(resolve, SIMULATE_API_DELAY_MS))

    UiHelper.hideTypingIndicator()

    const response = this.buildPlaceholderResponse(message, fileInfo)
    this.addMessageToUI(response, 'bot')
    this.saveMessage(response, 'bot')
  }

  buildPlaceholderResponse(message, fileInfo) {
    if (fileInfo) {
      return `Thank you for your message. I received a file named "${fileInfo.filename}". This is a placeholder response. The actual AI integration will be implemented in the backend.`
    }
    return `Thank you for your message. I received: "${message}". This is a placeholder response. The actual AI integration will be implemented in the backend.`
  }

  renderConversationList() {
    const listContainer = document.getElementById('conversationList')
    if (!listContainer) {
      this.handleMissingListContainer()
      return
    }

    listContainer.innerHTML = ''

    const conversationsToShow = this.conversations.slice(
      0,
      MAX_CONVERSATIONS_TO_DISPLAY
    )

    if (conversationsToShow.length === 0) {
      listContainer.innerHTML =
        '<p class="conversation-list-empty">No conversations yet</p>'
      return
    }

    conversationsToShow.forEach((conv) => {
      const item = this.createConversationItem(conv)
      listContainer.appendChild(item)
    })

    this.showMoreConversationsIfNeeded(listContainer)
    this.updateNewChatButton()
  }

  handleMissingListContainer() {
    const newChatBtn = document.getElementById('newChatBtn')
    if (newChatBtn) {
      newChatBtn.textContent = '+ ERROR: List not found'
    }
  }

  createConversationItem(conv) {
    const item = document.createElement('div')
    item.className = 'conversation-item'
    if (conv.id === this.currentConversationId) {
      item.classList.add('active')
    }

    const preview = document.createElement('p')
    preview.className = 'conversation-preview'
    preview.textContent = conv.title
    preview.title = conv.title

    item.appendChild(preview)
    item.addEventListener('click', () => this.loadConversation(conv.id))

    return item
  }

  showMoreConversationsIfNeeded(listContainer) {
    if (this.conversations.length > MAX_CONVERSATIONS_TO_DISPLAY) {
      const moreItem = document.createElement('div')
      moreItem.className = 'conversation-item-info'
      const moreText = document.createElement('p')
      moreText.className = 'conversation-preview conversation-count'
      moreText.textContent = `+${this.conversations.length - MAX_CONVERSATIONS_TO_DISPLAY} older conversations`
      moreItem.appendChild(moreText)
      listContainer.appendChild(moreItem)
    }
  }

  updateNewChatButton() {
    const newChatBtn = document.getElementById('newChatBtn')
    if (newChatBtn && this.conversations.length > 0) {
      newChatBtn.textContent = `+ New chat (${this.conversations.length})`
    }
  }
}

// Initialize conversation manager when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    globalThis.conversationManager = new ConversationManager()
  })
} else {
  globalThis.conversationManager = new ConversationManager()
}
