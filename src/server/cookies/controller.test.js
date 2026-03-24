import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  cookiesGetController,
  cookiesPostController,
  cookiesController
} from './controller.js'

const ANALYTICS_YES = 'yes'
const ANALYTICS_NO = 'no'
const COOKIES_VIEW = 'cookies/index'
const COOKIES_REDIRECT = '/cookies?saved=true'

function makeGetRequest(overrides = {}) {
  return {
    state: { cookie_preferences: {} },
    query: {},
    ...overrides
  }
}

function makePostRequest(overrides = {}) {
  return {
    payload: { analytics: ANALYTICS_YES },
    ...overrides
  }
}

function makeH() {
  const stateSpy = vi.fn()
  const redirectStub = {
    state: stateSpy
  }
  return {
    view: vi.fn(),
    redirect: vi.fn(() => redirectStub),
    _stateSpy: stateSpy
  }
}

describe('cookiesGetController - page rendering', () => {
  let h

  beforeEach(() => {
    h = makeH()
    vi.clearAllMocks()
  })

  it('should render cookies view with correct page title', () => {
    const request = makeGetRequest()
    cookiesGetController.handler(request, h)

    expect(h.view).toHaveBeenCalledWith(
      COOKIES_VIEW,
      expect.objectContaining({
        pageTitle: 'Cookies',
        heading: 'Cookies'
      })
    )
  })

  it('should set analyticsCookies to no when no preference stored', () => {
    const request = makeGetRequest()
    cookiesGetController.handler(request, h)

    expect(h.view).toHaveBeenCalledWith(
      COOKIES_VIEW,
      expect.objectContaining({ analyticsCookies: ANALYTICS_NO })
    )
  })

  it('should set analyticsCookies to yes when preference is true', () => {
    const request = makeGetRequest({
      state: { cookie_preferences: { analytics: true } }
    })
    cookiesGetController.handler(request, h)

    expect(h.view).toHaveBeenCalledWith(
      COOKIES_VIEW,
      expect.objectContaining({ analyticsCookies: ANALYTICS_YES })
    )
  })

  it('should set showConfirmation to true when query.saved is "true"', () => {
    const request = makeGetRequest({ query: { saved: 'true' } })
    cookiesGetController.handler(request, h)

    expect(h.view).toHaveBeenCalledWith(
      COOKIES_VIEW,
      expect.objectContaining({ showConfirmation: true })
    )
  })

  it('should set showConfirmation to false when query.saved is not set', () => {
    const request = makeGetRequest()
    cookiesGetController.handler(request, h)

    expect(h.view).toHaveBeenCalledWith(
      COOKIES_VIEW,
      expect.objectContaining({ showConfirmation: false })
    )
  })

  it('should include correct breadcrumbs', () => {
    const request = makeGetRequest()
    cookiesGetController.handler(request, h)

    expect(h.view).toHaveBeenCalledWith(
      COOKIES_VIEW,
      expect.objectContaining({
        breadcrumbs: expect.arrayContaining([
          expect.objectContaining({ text: 'Home', href: '/' })
        ])
      })
    )
  })

  it('should handle missing cookie_preferences state gracefully', () => {
    const request = makeGetRequest({ state: {} })
    cookiesGetController.handler(request, h)

    expect(h.view).toHaveBeenCalledWith(
      COOKIES_VIEW,
      expect.objectContaining({ analyticsCookies: ANALYTICS_NO })
    )
  })
})

describe('cookiesPostController - saving preferences', () => {
  let h

  beforeEach(() => {
    h = makeH()
    vi.clearAllMocks()
  })

  it('should redirect to /cookies?saved=true', () => {
    const request = makePostRequest()
    cookiesPostController.handler(request, h)

    expect(h.redirect).toHaveBeenCalledWith(COOKIES_REDIRECT)
  })

  it('should set cookie_preferences with analytics=true when analytics is yes', () => {
    const request = makePostRequest({ payload: { analytics: ANALYTICS_YES } })
    cookiesPostController.handler(request, h)

    expect(h._stateSpy).toHaveBeenCalledWith(
      'cookie_preferences',
      { analytics: true },
      expect.objectContaining({ isSameSite: 'Strict' })
    )
  })

  it('should set cookie_preferences with analytics=false when analytics is not yes', () => {
    const request = makePostRequest({ payload: { analytics: ANALYTICS_NO } })
    cookiesPostController.handler(request, h)

    expect(h._stateSpy).toHaveBeenCalledWith(
      'cookie_preferences',
      { analytics: false },
      expect.any(Object)
    )
  })

  it('should set cookie_preferences with analytics=false when payload is empty', () => {
    const request = makePostRequest({ payload: {} })
    cookiesPostController.handler(request, h)

    expect(h._stateSpy).toHaveBeenCalledWith(
      'cookie_preferences',
      { analytics: false },
      expect.any(Object)
    )
  })
})

describe('cookiesController legacy export', () => {
  it('should be the same as cookiesGetController', () => {
    expect(cookiesController).toBe(cookiesGetController)
  })
})
