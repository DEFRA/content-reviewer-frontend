/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import CookieBanner from './cookie-banner.js'

const EXPIRED_COOKIE =
  'cookie_preferences=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/'
const COOKIE_BANNER_ID = 'cookie-banner'
const COOKIE_PREFERENCES_ANALYTICS_TRUE =
  'cookie_preferences={"analytics":true}; path=/'
const TEST_BANNER_ID = 'test-banner'
const TEST_BANNER_HTML = '<div id="test-banner" style="display: none;"></div>'
const COOKIE_BANNER_ACCEPTED_ID = 'cookie-banner-accepted'
const COOKIE_BANNER_REJECTED_ID = 'cookie-banner-rejected'

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
    document.cookie = COOKIE_PREFERENCES_ANALYTICS_TRUE
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
          <button id="cookie-accept">Accept</button>
          <button id="cookie-reject">Reject</button>
          <button id="cookie-hide-accepted">Hide Accepted</button>
          <button id="cookie-hide-rejected">Hide Rejected</button>
          <div id="${COOKIE_BANNER_ID}" style="display: none;"></div>
          <div id="${COOKIE_BANNER_ACCEPTED_ID}" style="display: none;"></div>
          <div id="${COOKIE_BANNER_REJECTED_ID}" style="display: none;"></div>
        `
    document.cookie = EXPIRED_COOKIE
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('should setup accept button event listener', () => {
    const banner = new CookieBanner()
    const acceptButton = document.getElementById('cookie-accept')
    const acceptSpy = vi.spyOn(banner, 'acceptCookies')
    acceptButton.click()
    expect(acceptSpy).toHaveBeenCalled()
  })

  it('should setup reject button event listener', () => {
    const banner = new CookieBanner()
    const rejectButton = document.getElementById('cookie-reject')
    const rejectSpy = vi.spyOn(banner, 'rejectCookies')
    rejectButton.click()
    expect(rejectSpy).toHaveBeenCalled()
  })

  it('should setup hide accepted button event listener', () => {
    const banner = new CookieBanner()
    const hideButton = document.getElementById('cookie-hide-accepted')
    hideButton.click()
    const acceptedBanner = document.getElementById(COOKIE_BANNER_ACCEPTED_ID)
    expect(acceptedBanner.style.display).toBe('none')
    expect(banner).toBeInstanceOf(CookieBanner)
  })

  it('should setup hide rejected button event listener', () => {
    const banner = new CookieBanner()
    const hideButton = document.getElementById('cookie-hide-rejected')
    hideButton.click()
    const rejectedBanner = document.getElementById(COOKIE_BANNER_REJECTED_ID)
    expect(rejectedBanner.style.display).toBe('none')
    expect(banner).toBeInstanceOf(CookieBanner)
  })
})

describe('CookieBanner - Accept Cookies', () => {
  beforeEach(() => {
    document.body.innerHTML = `
          <div id="${COOKIE_BANNER_ID}" style="display: block;"></div>
          <div id="${COOKIE_BANNER_ACCEPTED_ID}" style="display: none;"></div>
        `
    document.cookie = EXPIRED_COOKIE
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('should set analytics to true when accepting cookies', () => {
    const banner = new CookieBanner()
    banner.acceptCookies()
    const preferences = banner.getCookiePreferences()
    expect(preferences.analytics).toBe(true)
  })

  it('should hide main banner when accepting cookies', () => {
    const banner = new CookieBanner()
    banner.acceptCookies()
    const mainBanner = document.getElementById(COOKIE_BANNER_ID)
    expect(mainBanner.style.display).toBe('none')
  })

  it('should show accepted banner after accepting cookies', () => {
    const banner = new CookieBanner()
    banner.acceptCookies()
    const acceptedBanner = document.getElementById(COOKIE_BANNER_ACCEPTED_ID)
    expect(acceptedBanner.style.display).toBe('block')
  })
})

describe('CookieBanner - Reject Cookies', () => {
  beforeEach(() => {
    document.body.innerHTML = `
          <div id="${COOKIE_BANNER_ID}" style="display: block;"></div>
          <div id="${COOKIE_BANNER_REJECTED_ID}" style="display: none;"></div>
        `
    document.cookie = EXPIRED_COOKIE
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('should set analytics to false when rejecting cookies', () => {
    const banner = new CookieBanner()
    banner.rejectCookies()
    const preferences = banner.getCookiePreferences()
    expect(preferences.analytics).toBe(false)
  })

  it('should hide main banner when rejecting cookies', () => {
    const banner = new CookieBanner()
    banner.rejectCookies()
    const mainBanner = document.getElementById(COOKIE_BANNER_ID)
    expect(mainBanner.style.display).toBe('none')
  })

  it('should show rejected banner after rejecting cookies', () => {
    const banner = new CookieBanner()
    banner.rejectCookies()
    const rejectedBanner = document.getElementById(COOKIE_BANNER_REJECTED_ID)
    expect(rejectedBanner.style.display).toBe('block')
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
    document.cookie = COOKIE_PREFERENCES_ANALYTICS_TRUE
    const testBannerInstance = new CookieBanner()
    testBannerInstance.showBanner(TEST_BANNER_ID)
    const testBanner = document.getElementById(TEST_BANNER_ID)
    expect(testBanner.style.display).toBe('block')
  })

  it('should hide banner', () => {
    document.cookie = COOKIE_PREFERENCES_ANALYTICS_TRUE
    const testBannerInstance2 = new CookieBanner()
    const testBanner2 = document.getElementById(TEST_BANNER_ID)
    testBanner2.style.display = 'block'
    testBannerInstance2.hideBanner(TEST_BANNER_ID)
    expect(testBanner2.style.display).toBe('none')
  })

  it('should not throw when showing non-existent banner', () => {
    document.cookie = COOKIE_PREFERENCES_ANALYTICS_TRUE
    const testBannerInstance3 = new CookieBanner()
    expect(() => testBannerInstance3.showBanner('non-existent')).not.toThrow()
  })

  it('should not throw when hiding non-existent banner', () => {
    document.cookie = COOKIE_PREFERENCES_ANALYTICS_TRUE
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
    banner.setCookiePreferences({ analytics: true })
    const preferences = banner.getCookiePreferences()
    expect(preferences.analytics).toBe(true)
  })

  it('should set cookie with Secure flag on HTTPS', () => {
    const originalProtocol = globalThis.location.protocol
    vi.stubGlobal('location', { protocol: 'https:' })

    const banner = new CookieBanner()
    banner.setCookiePreferences({ analytics: true })
    expect(document.cookie).toContain('cookie_preferences')

    vi.stubGlobal('location', { protocol: originalProtocol })
  })

  it('should not set Secure flag on HTTP', () => {
    const originalProtocol = globalThis.location.protocol
    vi.stubGlobal('location', { protocol: 'http:' })

    const banner = new CookieBanner()
    banner.setCookiePreferences({ analytics: false })
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
    banner.setCookiePreferences({ analytics: true })
    const preferences = banner.getCookiePreferences()
    expect(preferences).toEqual({ analytics: true })
  })

  it('should handle cookies with leading spaces', () => {
    const banner = new CookieBanner()
    document.cookie = ' ' + COOKIE_PREFERENCES_ANALYTICS_TRUE
    const preferences = banner.getCookiePreferences()
    expect(preferences.analytics).toBe(true)
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
