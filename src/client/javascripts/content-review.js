// GOV.UK Content Review Tool - Chat Interface
// Handles chat UI and API communication with backend

class ChatBot {
  constructor() {
    this.chatMessages = document.getElementById('chatMessages')
    this.chatForm = document.getElementById('chatForm')
    this.userInput = document.getElementById('userInput')
    this.sendButton = document.getElementById('sendButton')
    this.conversationList = document.getElementById('conversationList')
    this.newChatBtn = document.getElementById('newChatBtn')

    // Get backend API URL from config (will be set by server)
    this.apiUrl = window.BACKEND_API_URL || 'http://localhost:5000'

    this.currentConversationId = null
    this.conversations = this.loadConversations()

    this.init()
  }

  init() {
    // Load conversations from localStorage
    this.renderConversationList()

    // Start with a new conversation or load the most recent one
    if (this.conversations.length > 0) {
      this.loadConversation(this.conversations[0].id)
    } else {
      this.startNewConversation()
    }

    // New chat button
    this.newChatBtn.addEventListener('click', () => {
      this.startNewConversation()
    })

    // Form submission
    this.chatForm.addEventListener('submit', (e) => {
      e.preventDefault()
      this.handleSendMessage()
    })

    // Auto-resize textarea
    this.userInput.addEventListener('input', () => {
      this.autoResizeTextarea()
    })

    // Handle suggestion chips
    const suggestionChips = document.querySelectorAll('.suggestion-chip')
    suggestionChips.forEach((chip) => {
      chip.addEventListener('click', () => {
        const suggestion = chip.getAttribute('data-suggestion')
        this.userInput.value = suggestion
        this.userInput.focus()
      })
    })

    // Enable send on Ctrl+Enter or Cmd+Enter
    this.userInput.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault()
        this.handleSendMessage()
      }
    })
  }

  autoResizeTextarea() {
    this.userInput.style.height = 'auto'
    this.userInput.style.height =
      Math.min(this.userInput.scrollHeight, 200) + 'px'
  }

  async handleSendMessage() {
    const message = this.userInput.value.trim()

    if (!message) {
      return
    }

    // Add user message
    this.addMessage(message, 'user')

    // Save message to conversation
    this.saveMessageToConversation(message, 'user')

    // Clear input
    this.userInput.value = ''
    this.userInput.style.height = 'auto'

    // Disable input while processing
    this.setInputState(false)

    // Show typing indicator
    this.showTypingIndicator()

    try {
      // Call backend API
      const response = await fetch(`${this.apiUrl}/api/chat/message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ message })
      })

      if (!response.ok) {
        throw new Error('Failed to get response from server')
      }

      const data = await response.json()

      this.removeTypingIndicator()

      // Add bot response
      this.addMessage(data.response, 'bot')
      this.saveMessageToConversation(data.response, 'bot')

      // Show validation warning if present
      if (data.warning) {
        console.warn('Validation warning:', data.warning)
        console.log('Validation details:', data.validation)
      }
    } catch (error) {
      console.error('Error getting bot response:', error)
      this.removeTypingIndicator()

      const errorMessage =
        "I'm sorry, I'm having trouble connecting to the server. Please try again later."
      this.addMessage(errorMessage, 'bot')
    } finally {
      this.setInputState(true)
      this.userInput.focus()
    }
  }

  addMessage(text, sender, shouldScroll = true) {
    const messageDiv = document.createElement('div')
    messageDiv.className = `message ${sender}-message`

    const contentDiv = document.createElement('div')
    contentDiv.className = 'message-content'

    // Parse and format the message
    contentDiv.innerHTML = this.formatMessage(text)

    messageDiv.appendChild(contentDiv)
    this.chatMessages.appendChild(messageDiv)

    // Scroll to bottom
    if (shouldScroll) {
      this.scrollToBottom()
    }
  }

  formatMessage(text) {
    // Convert line breaks to paragraphs
    const paragraphs = text.split('\n\n').filter((p) => p.trim())

    let formattedText = ''
    paragraphs.forEach((para) => {
      // Check if paragraph is a list
      if (para.includes('\n- ') || para.includes('\n* ')) {
        const lines = para.split('\n')
        const listItems = lines.filter(
          (line) =>
            line.trim().startsWith('- ') || line.trim().startsWith('* ')
        )

        if (listItems.length > 0) {
          formattedText += '<ul>'
          listItems.forEach((item) => {
            const cleanItem = item.trim().replace(/^[*-]\s*/, '')
            formattedText += `<li>${this.escapeHtml(cleanItem)}</li>`
          })
          formattedText += '</ul>'
        } else {
          formattedText += `<p>${this.escapeHtml(para)}</p>`
        }
      } else {
        formattedText += `<p>${this.escapeHtml(para)}</p>`
      }
    })

    return formattedText || `<p>${this.escapeHtml(text)}</p>`
  }

  escapeHtml(text) {
    const div = document.createElement('div')
    div.textContent = text
    return div.innerHTML
  }

  showTypingIndicator() {
    const typingDiv = document.createElement('div')
    typingDiv.className = 'message bot-message'
    typingDiv.id = 'typing-indicator'

    const indicatorDiv = document.createElement('div')
    indicatorDiv.className = 'typing-indicator'
    indicatorDiv.innerHTML = '<span></span><span></span><span></span>'

    typingDiv.appendChild(indicatorDiv)
    this.chatMessages.appendChild(typingDiv)

    this.scrollToBottom()
  }

  removeTypingIndicator() {
    const indicator = document.getElementById('typing-indicator')
    if (indicator) {
      indicator.remove()
    }
  }

  setInputState(enabled) {
    this.userInput.disabled = !enabled
    this.sendButton.disabled = !enabled
  }

  scrollToBottom() {
    this.chatMessages.scrollTop = this.chatMessages.scrollHeight
  }

  // Conversation management methods
  loadConversations() {
    const saved = localStorage.getItem('govuk_conversations')
    return saved ? JSON.parse(saved) : []
  }

  saveConversations() {
    localStorage.setItem('govuk_conversations', JSON.stringify(this.conversations))
  }

  startNewConversation() {
    const newConv = {
      id: Date.now().toString(),
      title: 'New conversation',
      messages: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }

    this.conversations.unshift(newConv)
    this.currentConversationId = newConv.id
    this.saveConversations()
    this.clearChatMessages()
    this.renderConversationList()

    // Add welcome message
    const welcomeMessage = `Hello! I'm here to help you review content for GOV.UK websites.

You can:
- Paste content for me to review
- Ask about GOV.UK content standards
- Check formatting and readability
- Get suggestions for improvement

How can I help you today?`
    this.addMessage(welcomeMessage, 'bot')
  }

  loadConversation(conversationId) {
    this.currentConversationId = conversationId
    const conversation = this.conversations.find((c) => c.id === conversationId)

    if (conversation) {
      this.clearChatMessages()
      conversation.messages.forEach((msg) => {
        this.addMessage(msg.text, msg.sender, false)
      })
      this.renderConversationList()
    }
  }

  saveMessageToConversation(text, sender) {
    const conversation = this.conversations.find(
      (c) => c.id === this.currentConversationId
    )

    if (conversation) {
      conversation.messages.push({
        text,
        sender,
        timestamp: new Date().toISOString()
      })
      conversation.updatedAt = new Date().toISOString()

      // Update title based on first user message
      if (
        sender === 'user' &&
        conversation.messages.filter((m) => m.sender === 'user').length === 1
      ) {
        conversation.title =
          text.substring(0, 50) + (text.length > 50 ? '...' : '')
      }

      this.saveConversations()
      this.renderConversationList()
    }
  }

  deleteConversation(conversationId, event) {
    event.stopPropagation()

    if (confirm('Are you sure you want to delete this conversation?')) {
      this.conversations = this.conversations.filter(
        (c) => c.id !== conversationId
      )
      this.saveConversations()
      this.renderConversationList()

      if (this.currentConversationId === conversationId) {
        if (this.conversations.length > 0) {
          this.loadConversation(this.conversations[0].id)
        } else {
          this.startNewConversation()
        }
      }
    }
  }

  clearChatMessages() {
    this.chatMessages.innerHTML = ''
  }

  renderConversationList() {
    this.conversationList.innerHTML = ''

    this.conversations.forEach((conv) => {
      const item = document.createElement('div')
      item.className =
        'conversation-item' +
        (conv.id === this.currentConversationId ? ' active' : '')

      const titleSpan = document.createElement('span')
      titleSpan.className = 'conversation-item-title'
      titleSpan.textContent = conv.title

      const deleteBtn = document.createElement('button')
      deleteBtn.className = 'conversation-delete-btn'
      deleteBtn.innerHTML = '×'
      deleteBtn.setAttribute('aria-label', 'Delete conversation')
      deleteBtn.onclick = (e) => this.deleteConversation(conv.id, e)

      item.appendChild(titleSpan)
      item.appendChild(deleteBtn)

      item.onclick = () => this.loadConversation(conv.id)

      this.conversationList.appendChild(item)
    })
  }
}

// Initialize the chatbot when the page loads
document.addEventListener('DOMContentLoaded', () => {
  new ChatBot()
})
