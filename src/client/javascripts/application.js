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

  addMessageToUI(content, role) {
    const chatMessages = document.getElementById('chatMessages')
    if (!chatMessages) {
      return
    }

    const messageDiv = document.createElement('div')
    messageDiv.className = `message ${role}-message`

    const contentDiv = document.createElement('div')
    contentDiv.className = 'message-content'
    contentDiv.innerHTML = `<p>${this.escapeHtml(content)}</p>`

    messageDiv.appendChild(contentDiv)
    chatMessages.appendChild(messageDiv)
    chatMessages.scrollTop = chatMessages.scrollHeight
  }

  saveMessage(content, role) {
    const conversation = this.conversations.find(
      (c) => c.id === this.currentConversationId
    )
    if (conversation) {
      conversation.messages.push({
        content,
        role,
        timestamp: new Date().toISOString()
      })

      // Update conversation title from first user message
      if (
        role === 'user' &&
        conversation.messages.filter((m) => m.role === 'user').length === 1
      ) {
        conversation.title =
          content.substring(0, 50) + (content.length > 50 ? '...' : '')
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
    if (!message) {
      return
    }

    // Clear input FIRST
    userInput.value = ''

    // Add user message to UI and save
    this.addMessageToUI(message, 'user')
    this.saveMessage(message, 'user')

    // Show typing indicator
    this.showTypingIndicator()

    try {
      // TODO: Replace with actual API call to backend
      // For now, just show a placeholder response
      await this.simulateAPICall(message)
    } catch (error) {
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

  async simulateAPICall(message) {
    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, 1000))

    this.hideTypingIndicator()

    // Placeholder response
    const response = `Thank you for your message. I received: "${message}". This is a placeholder response. The actual AI integration will be implemented in the backend.`

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
