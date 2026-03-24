import { describe, it, expect, vi, beforeEach } from 'vitest'
import { loginController } from './controller.js'

const LOGIN_VIEW = 'auth/login/index'
const HOME_PATH = '/'

function makeRequest(overrides = {}) {
  return {
    auth: { isAuthenticated: false },
    query: {},
    ...overrides
  }
}

function makeH() {
  return {
    redirect: vi.fn((url) => ({ redirectUrl: url })),
    view: vi.fn((template, ctx) => ({ template, ctx }))
  }
}

describe('loginController - authenticated user', () => {
  let h

  beforeEach(() => {
    h = makeH()
    vi.clearAllMocks()
  })

  it('should redirect to home when user is already authenticated', () => {
    const request = makeRequest({ auth: { isAuthenticated: true } })
    loginController.handler(request, h)

    expect(h.redirect).toHaveBeenCalledWith(HOME_PATH)
  })
})

describe('loginController - unauthenticated user', () => {
  let h

  beforeEach(() => {
    h = makeH()
    vi.clearAllMocks()
  })

  it('should render login view with no error when no error query param', () => {
    const request = makeRequest()
    loginController.handler(request, h)

    expect(h.view).toHaveBeenCalledWith(
      LOGIN_VIEW,
      expect.objectContaining({
        pageTitle: 'Sign in – Content Review Tool – GOV.UK',
        heading: 'Sign in',
        serviceName: 'Content Review Tool',
        errorMessage: null
      })
    )
  })

  it('should render login view with auth_failed error message', () => {
    const request = makeRequest({ query: { error: 'auth_failed' } })
    loginController.handler(request, h)

    expect(h.view).toHaveBeenCalledWith(
      LOGIN_VIEW,
      expect.objectContaining({
        errorMessage: expect.stringContaining('Sign in failed')
      })
    )
  })

  it('should render login view with invalid_state error message', () => {
    const request = makeRequest({ query: { error: 'invalid_state' } })
    loginController.handler(request, h)

    expect(h.view).toHaveBeenCalledWith(
      LOGIN_VIEW,
      expect.objectContaining({
        errorMessage: expect.stringContaining('Invalid login state')
      })
    )
  })

  it('should render login view with unauthorized_tenant error message', () => {
    const request = makeRequest({ query: { error: 'unauthorized_tenant' } })
    loginController.handler(request, h)

    expect(h.view).toHaveBeenCalledWith(
      LOGIN_VIEW,
      expect.objectContaining({
        errorMessage: expect.stringContaining('Your account is not authorized')
      })
    )
  })

  it('should render login view with generic error message for unknown error codes', () => {
    const request = makeRequest({ query: { error: 'unknown_code' } })
    loginController.handler(request, h)

    expect(h.view).toHaveBeenCalledWith(
      LOGIN_VIEW,
      expect.objectContaining({
        errorMessage: expect.stringContaining(
          'An error occurred during sign in'
        )
      })
    )
  })
})
