/**
 * Cookie Banner Management
 * Handles the essential-only cookie information banner for the GOV.UK service.
 * This service uses no analytics or tracking cookies — the banner is informational only.
 */

class CookieBanner {
  COOKIE_NAME = 'cookie_preferences'
  COOKIE_DURATION = 90 // days
  BANNER_ID = 'cookie-banner'

  constructor() {
    this.init()
  }

  init() {
    // Show the banner if user has not yet dismissed it
    const cookiePreferences = this.getCookiePreferences()
    if (!cookiePreferences) {
      this.showBanner(this.BANNER_ID)
    }

    this.setupEventListeners()
  }

  setupEventListeners() {
    const hideButton = document.getElementById('cookie-hide')

    if (hideButton) {
      hideButton.addEventListener('click', () => this.hideCookieBanner())
    }
  }

  hideCookieBanner() {
    this.setCookiePreferences({ seen: true })
    this.hideBanner(this.BANNER_ID)
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
    const isSecure = globalThis.location.protocol === 'https:'
    const secureFlag = isSecure ? '; Secure' : ''

    document.cookie = `${this.COOKIE_NAME}=${value}; expires=${expiryDate.toUTCString()}; path=/; SameSite=Strict${secureFlag}`
  }

  getCookiePreferences() {
    const nameEQ = this.COOKIE_NAME + '='
    const cookies = document.cookie.split(';')

    for (const cookieItem of cookies) {
      let cookie = cookieItem
      while (cookie.startsWith(' ')) {
        cookie = cookie.substring(1, cookie.length)
      }
      if (cookie.startsWith(nameEQ)) {
        try {
          return JSON.parse(cookie.substring(nameEQ.length, cookie.length))
        } catch {
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
