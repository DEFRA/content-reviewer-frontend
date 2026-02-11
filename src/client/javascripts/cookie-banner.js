/**
 * Cookie Banner Management
 * Handles the cookie consent banner for the GOV.UK service
 */

class CookieBanner {
  constructor() {
    this.COOKIE_NAME = 'cookie_preferences'
    this.COOKIE_DURATION = 90 // days (Defra standard for essential cookies)
    this.init()
  }

  init() {
    // Check if user has already made a choice
    const cookiePreferences = this.getCookiePreferences()

    if (!cookiePreferences) {
      // Show the initial cookie banner
      this.showBanner('cookie-banner')
    }

    // Set up event listeners
    this.setupEventListeners()
  }

  setupEventListeners() {
    const acceptButton = document.getElementById('cookie-accept')
    const rejectButton = document.getElementById('cookie-reject')
    const hideAcceptedButton = document.getElementById('cookie-hide-accepted')
    const hideRejectedButton = document.getElementById('cookie-hide-rejected')

    if (acceptButton) {
      acceptButton.addEventListener('click', () => this.acceptCookies())
    }

    if (rejectButton) {
      rejectButton.addEventListener('click', () => this.rejectCookies())
    }

    if (hideAcceptedButton) {
      hideAcceptedButton.addEventListener('click', () =>
        this.hideBanner('cookie-banner-accepted')
      )
    }

    if (hideRejectedButton) {
      hideRejectedButton.addEventListener('click', () =>
        this.hideBanner('cookie-banner-rejected')
      )
    }
  }

  acceptCookies() {
    this.setCookiePreferences({ analytics: true })
    this.hideBanner('cookie-banner')
    this.showBanner('cookie-banner-accepted')
    // Here you would initialize analytics if you had them
  }

  rejectCookies() {
    this.setCookiePreferences({ analytics: false })
    this.hideBanner('cookie-banner')
    this.showBanner('cookie-banner-rejected')
  }

  showBanner(bannerId) {
    const banner = document.getElementById(bannerId)
    if (banner) {
      banner.style.display = 'block'
    }
  }

  hideBanner(bannerId) {
    const banner = document.getElementById(bannerId)
    if (banner) {
      banner.style.display = 'none'
    }
  }

  setCookiePreferences(preferences) {
    const value = JSON.stringify(preferences)
    const expiryDate = new Date()
    expiryDate.setDate(expiryDate.getDate() + this.COOKIE_DURATION)

    // Set Secure flag when using HTTPS (production)
    const isSecure = window.location.protocol === 'https:'
    const secureFlag = isSecure ? '; Secure' : ''

    document.cookie = `${this.COOKIE_NAME}=${value}; expires=${expiryDate.toUTCString()}; path=/; SameSite=Strict${secureFlag}`
  }

  getCookiePreferences() {
    const nameEQ = this.COOKIE_NAME + '='
    const cookies = document.cookie.split(';')

    for (let i = 0; i < cookies.length; i++) {
      let cookie = cookies[i]
      while (cookie.charAt(0) === ' ') {
        cookie = cookie.substring(1, cookie.length)
      }
      if (cookie.indexOf(nameEQ) === 0) {
        try {
          return JSON.parse(cookie.substring(nameEQ.length, cookie.length))
        } catch (e) {
          return null
        }
      }
    }
    return null
  }
}

// Initialize cookie banner
function initCookieBanner() {
  const banner = new CookieBanner()
  return banner
}

// Initialize cookie banner when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    initCookieBanner()
  })
} else {
  initCookieBanner()
}

export default CookieBanner
