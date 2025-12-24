import {
  createAll,
  Button,
  Checkboxes,
  ErrorSummary,
  Header,
  Radios,
  SkipLink
} from 'govuk-frontend'

createAll(Button)
createAll(Checkboxes)
createAll(ErrorSummary)
createAll(Header)
createAll(Radios)
createAll(SkipLink)

// Initialize ChatBot for content review page
document.addEventListener('DOMContentLoaded', () => {
  const chatForm = document.getElementById('chatForm')
  
  if (chatForm) {
    // Import and initialize the ChatBot class
    import('./content-review.js').then(() => {
      // ChatBot will auto-initialize
    }).catch((err) => {
      console.error('Failed to load content-review module:', err)
    })
  }
})
