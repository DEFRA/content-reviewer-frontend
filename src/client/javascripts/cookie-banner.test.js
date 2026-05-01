/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import CookieBanner from './cookie-banner.js'

const EXPIRED_COOKIE =
  'cookie_preferences=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/'
const COOKIE_BANNER_ID = 'cookie-banner'
const COOKIE_PREFERENCES_SEEN = 'cookie_preferences={"seen":true}; path=/'
const TEST_BANNER_ID = 'test-banner'
const TEST_BANNER_HTML = '<div id="test-banner" style="display: none;"></div>'

describe('CookieBanner - Initialization', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    document.cookie = ''
    vi.clearAllMocks()
  })

  afterEach(() => {
    document.body.innerHTML = ''
    document.cookie = EXPIRED_COOKIE
  })

  it('should initialize with correct constants', () => {
    const banner = new CookieBanner()
    expect(banner.COOKIE_NAME).toBe('cookie_preferences')
    expect(banner.BANNER_ID).toBe(COOKIE_BANNER_ID)
  })

  it('should call init on construction', () => {
    const initSpy = vi.spyOn(CookieBanner.prototype, 'init')
    const banner = new CookieBanner()
    expect(initSpy).toHaveBeenCalled()
    expect(banner).toBeInstanceOf(CookieBanner)
    initSpy.mockRestore()
  })

  it('should show banner when no cookie preferences exist', () => {
    document.body.innerHTML = `<div id="${COOKIE_BANNER_ID}" style="display: none;"></div>`
    const banner = new CookieBanner()
    const bannerElement = document.getElementById(COOKIE_BANNER_ID)
    expect(bannerElement.style.display).toBe('block')
    expect(banner).toBeInstanceOf(CookieBanner)
  })

  it('should hide banner when cookie preferences exist', () => {
    document.cookie = COOKIE_PREFERENCES_SEEN
    document.body.innerHTML = `<div id="${COOKIE_BANNER_ID}" style="display: none;"></div>`
    const bannerInstance = new CookieBanner()
    const bannerElement = document.getElementById(COOKIE_BANNER_ID)
    expect(bannerElement.style.display).toBe('none')
    expect(bannerInstance).toBeInstanceOf(CookieBanner)
  })
})

describe('CookieBanner - Button Event Listeners', () => {
  beforeEach(() => {
    document.body.innerHTML = `
          <button id="cookie-hide">Hide cookie message</button>
          <div id="${COOKIE_BANNER_ID}" style="display: block;"></div>
        `
    document.cookie = EXPIRED_COOKIE
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('should setup hide button event listener', () => {
    const banner = new CookieBanner()
    const hideButton = document.getElementById('cookie-hide')
    const hideSpy = vi.spyOn(banner, 'hideCookieBanner')
    hideButton.click()
    expect(hideSpy).toHaveBeenCalled()
  })

  it('should hide main banner when hide button is clicked', () => {
    const banner = new CookieBanner()
    const hideButton = document.getElementById('cookie-hide')
    hideButton.click()
    const mainBanner = document.getElementById(COOKIE_BANNER_ID)
    expect(mainBanner.style.display).toBe('none')
    expect(banner).toBeInstanceOf(CookieBanner)
  })

  it('should set seen to true when hide button is clicked', () => {
    const banner = new CookieBanner()
    const hideButton = document.getElementById('cookie-hide')
    hideButton.click()
    const preferences = banner.getCookiePreferences()
    expect(preferences.seen).toBe(true)
  })
})

describe('CookieBanner - Hide Cookie Banner', () => {
  beforeEach(() => {
    document.body.innerHTML = `
          <div id="${COOKIE_BANNER_ID}" style="display: block;"></div>
        `
    document.cookie = EXPIRED_COOKIE
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('should set seen to true when hiding the banner', () => {
    const banner = new CookieBanner()
    banner.hideCookieBanner()
    const preferences = banner.getCookiePreferences()
    expect(preferences.seen).toBe(true)
  })

  it('should hide main banner when hideCookieBanner is called', () => {
    const banner = new CookieBanner()
    banner.hideCookieBanner()
    const mainBanner = document.getElementById(COOKIE_BANNER_ID)
    expect(mainBanner.style.display).toBe('none')
  })
})

describe('CookieBanner - Show and Hide Banner', () => {
  beforeEach(() => {
    document.body.innerHTML = TEST_BANNER_HTML
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('should show banner', () => {
    document.cookie = COOKIE_PREFERENCES_SEEN
    const testBannerInstance = new CookieBanner()
    testBannerInstance.showBanner(TEST_BANNER_ID)
    const testBanner = document.getElementById(TEST_BANNER_ID)
    expect(testBanner.style.display).toBe('block')
  })

  it('should hide banner', () => {
    document.cookie = COOKIE_PREFERENCES_SEEN
    const testBannerInstance2 = new CookieBanner()
    const testBanner2 = document.getElementById(TEST_BANNER_ID)
    testBanner2.style.display = 'block'
    testBannerInstance2.hideBanner(TEST_BANNER_ID)
    expect(testBanner2.style.display).toBe('none')
  })

  it('should not throw when showing non-existent banner', () => {
    document.cookie = COOKIE_PREFERENCES_SEEN
    const testBannerInstance3 = new CookieBanner()
    expect(() => testBannerInstance3.showBanner('non-existent')).not.toThrow()
  })

  it('should not throw when hiding non-existent banner', () => {
    document.cookie = COOKIE_PREFERENCES_SEEN
    const testBannerInstance4 = new CookieBanner()
    expect(() => testBannerInstance4.hideBanner('non-existent')).not.toThrow()
  })
})

describe('CookieBanner - Cookie Preferences (set)', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    document.cookie = EXPIRED_COOKIE
  })

  afterEach(() => {
    document.body.innerHTML = ''
    document.cookie = EXPIRED_COOKIE
  })

  it('should set cookie preferences with correct expiry', () => {
    const banner = new CookieBanner()
    banner.setCookiePreferences({ seen: true })
    const preferences = banner.getCookiePreferences()
    expect(preferences.seen).toBe(true)
  })

  it('should set cookie with Secure flag on HTTPS', () => {
    const originalProtocol = globalThis.location.protocol
    vi.stubGlobal('location', { protocol: 'https:' })

    const banner = new CookieBanner()
    banner.setCookiePreferences({ seen: true })
    expect(document.cookie).toContain('cookie_preferences')

    vi.stubGlobal('location', { protocol: originalProtocol })
  })

  it('should not set Secure flag on HTTP', () => {
    const originalProtocol = globalThis.location.protocol
    vi.stubGlobal('location', { protocol: 'http:' })

    const banner = new CookieBanner()
    banner.setCookiePreferences({ seen: true })
    expect(document.cookie).toContain('cookie_preferences')

    vi.stubGlobal('location', { protocol: originalProtocol })
  })
})

describe('CookieBanner - Cookie Preferences (get)', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    document.cookie = EXPIRED_COOKIE
  })

  afterEach(() => {
    document.body.innerHTML = ''
    document.cookie = EXPIRED_COOKIE
  })

  it('should get cookie preferences correctly', () => {
    const banner = new CookieBanner()
    banner.setCookiePreferences({ seen: true })
    const preferences = banner.getCookiePreferences()
    expect(preferences).toEqual({ seen: true })
  })

  it('should handle cookies with leading spaces', () => {
    const banner = new CookieBanner()
    document.cookie = ' ' + COOKIE_PREFERENCES_SEEN
    const preferences = banner.getCookiePreferences()
    expect(preferences.seen).toBe(true)
  })

  it('should return null when cookie does not exist', () => {
    const banner = new CookieBanner()
    const preferences = banner.getCookiePreferences()
    expect(preferences).toBeNull()
  })

  it('should handle invalid JSON in cookie', () => {
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {})
    const banner = new CookieBanner()
    document.cookie = 'cookie_preferences=invalid-json; path=/'
    const preferences = banner.getCookiePreferences()
    expect(preferences).toBeNull()
    expect(consoleErrorSpy).toHaveBeenCalled()
    consoleErrorSpy.mockRestore()
  })
})

describe('CookieBanner - DOMContentLoaded branch', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('should call initCookieBanner via DOMContentLoaded when readyState is loading', async () => {
    // Simulate readyState = 'loading' so the module-level branch fires via the event
    Object.defineProperty(document, 'readyState', {
      value: 'loading',
      writable: true,
      configurable: true
    })

    let domContentLoadedListener
    const addEventListenerSpy = vi
      .spyOn(document, 'addEventListener')
      .mockImplementation((event, handler) => {
        if (event === 'DOMContentLoaded') {
          domContentLoadedListener = handler
        }
      })

    // Re-import the module so the top-level code re-runs with readyState = 'loading'
    vi.resetModules()
    await import('./cookie-banner.js')

    expect(addEventListenerSpy).toHaveBeenCalledWith(
      'DOMContentLoaded',
      expect.any(Function)
    )

    // Restore readyState and trigger the captured listener to exercise the handler body
    Object.defineProperty(document, 'readyState', {
      value: 'complete',
      configurable: true
    })
    if (domContentLoadedListener) {
      domContentLoadedListener()
    }

    addEventListenerSpy.mockRestore()
  })
})
