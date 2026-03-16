import { describe, test, expect, beforeEach, vi } from 'vitest'
import { azureAuth } from './azure-auth.js'

const mockMsalClient = vi.hoisted(() => ({
  getAuthCodeUrl: vi.fn(),
  acquireTokenByCode: vi.fn()
}))

const mockConfig = vi.hoisted(() => ({
  get: vi.fn()
}))

const mockLogger = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn()
}))

vi.mock('../../config/azure-auth.js', () => ({
  msalClient: mockMsalClient
}))

vi.mock('../../config/config.js', () => ({
  config: mockConfig
}))

vi.mock('../common/helpers/logging/logger.js', () => ({
  createLogger: () => mockLogger
}))

const TEST_CONSTANTS = {
  AUTH_CODE: 'test-auth-code-123',
  AUTH_URL: 'https://login.microsoftonline.com/auth',
  REDIRECT_URI: 'http://localhost:3000/auth/callback',
  POST_LOGOUT_URI: 'http://localhost:3000/auth/logout',
  TENANT_ID: 'test-tenant-id',
  USER_ID: 'user-home-id-123',
  USER_EMAIL: 'test@example.com',
  USER_NAME: 'Test User',
  SESSION_ID: 'session-123',
  ZERO: 0,
  ONE: 1
}

const ROUTES = {
  LOGIN: '/auth/login',
  CALLBACK: '/auth/callback',
  LOGOUT: '/auth/logout',
  LOGIN_ERROR: '/auth/login-page?error=auth_failed',
  INVALID_STATE: '/auth/login-page?error=invalid_state'
}

const CONFIG_KEYS = {
  REDIRECT_URI: 'azure.redirectUri',
  TENANT_ID: 'azure.tenantId',
  POST_LOGOUT_URI: 'azure.postLogoutRedirectUri'
}

function setupMockConfig() {
  mockConfig.get.mockImplementation((key) => {
    if (key === CONFIG_KEYS.REDIRECT_URI) {
      return TEST_CONSTANTS.REDIRECT_URI
    }
    if (key === CONFIG_KEYS.TENANT_ID) {
      return TEST_CONSTANTS.TENANT_ID
    }
    if (key === CONFIG_KEYS.POST_LOGOUT_URI) {
      return TEST_CONSTANTS.POST_LOGOUT_URI
    }
    return null
  })
}

function setupMockConfigWithoutTenant() {
  mockConfig.get.mockImplementation((key) => {
    if (key === CONFIG_KEYS.REDIRECT_URI) {
      return TEST_CONSTANTS.REDIRECT_URI
    }
    if (key === CONFIG_KEYS.POST_LOGOUT_URI) {
      return TEST_CONSTANTS.POST_LOGOUT_URI
    }
    return null
  })
}

describe('azureAuth Plugin - Registration', () => {
  test('Should export plugin with correct name', () => {
    expect(azureAuth.plugin).toBeDefined()
    expect(azureAuth.plugin.name).toBe('azure-auth')
  })
  test('Should register routes on server', () => {
    const mockServer = {
      route: vi.fn()
    }
    azureAuth.plugin.register(mockServer)
    expect(mockServer.route).toHaveBeenCalledTimes(TEST_CONSTANTS.ONE)
    expect(mockServer.route).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          method: 'GET',
          path: ROUTES.LOGIN
        }),
        expect.objectContaining({
          method: 'GET',
          path: ROUTES.CALLBACK
        }),
        expect.objectContaining({
          method: 'GET',
          path: ROUTES.LOGOUT
        })
      ])
    )
  })
})

describe('azureAuth - Login Handler - Success', () => {
  let mockServer
  let loginHandler
  beforeEach(() => {
    vi.clearAllMocks()
    setupMockConfig()
    mockServer = {
      route: vi.fn((routes) => {
        const loginRoute = routes.find((r) => r.path === ROUTES.LOGIN)
        if (loginRoute) {
          loginHandler = loginRoute.handler
        }
      })
    }
    azureAuth.plugin.register(mockServer)
  })
  test('Should redirect to Azure AD login URL', async () => {
    mockMsalClient.getAuthCodeUrl.mockResolvedValueOnce(TEST_CONSTANTS.AUTH_URL)
    const request = {}
    const h = {
      redirect: vi.fn((url) => ({ redirectTo: url }))
    }
    await loginHandler(request, h)
    expect(mockMsalClient.getAuthCodeUrl).toHaveBeenCalledWith({
      scopes: ['openid', 'profile', 'email'],
      redirectUri: TEST_CONSTANTS.REDIRECT_URI,
      responseMode: 'query'
    })
    expect(h.redirect).toHaveBeenCalledWith(TEST_CONSTANTS.AUTH_URL)
    expect(mockLogger.info).toHaveBeenCalledWith(
      'Redirecting to Azure AD login'
    )
  })
})

describe('azureAuth - Login Handler - Errors', () => {
  let mockServer
  let loginHandler
  beforeEach(() => {
    vi.clearAllMocks()
    setupMockConfig()
    mockServer = {
      route: vi.fn((routes) => {
        const loginRoute = routes.find((r) => r.path === ROUTES.LOGIN)
        if (loginRoute) {
          loginHandler = loginRoute.handler
        }
      })
    }
    azureAuth.plugin.register(mockServer)
  })
  test('Should redirect to error page when MSAL client not initialized', async () => {
    const originalMsalClient = mockMsalClient.getAuthCodeUrl
    vi.mocked(await import('../../config/azure-auth.js')).msalClient = null
    mockServer = {
      route: vi.fn((routes) => {
        const loginRoute = routes.find((r) => r.path === ROUTES.LOGIN)
        if (loginRoute) {
          loginHandler = loginRoute.handler
        }
      })
    }
    azureAuth.plugin.register(mockServer)
    const request = {}
    const h = {
      redirect: vi.fn((url) => ({ redirectTo: url }))
    }
    await loginHandler(request, h)
    expect(h.redirect).toHaveBeenCalledWith(ROUTES.LOGIN_ERROR)
    expect(mockLogger.error).toHaveBeenCalled()
    vi.mocked(await import('../../config/azure-auth.js')).msalClient =
      mockMsalClient
    mockMsalClient.getAuthCodeUrl = originalMsalClient
  })
  test('Should handle errors during login', async () => {
    mockMsalClient.getAuthCodeUrl.mockRejectedValueOnce(
      new Error('Auth URL error')
    )
    const request = {}
    const h = {
      redirect: vi.fn((url) => ({ redirectTo: url }))
    }
    await loginHandler(request, h)
    expect(h.redirect).toHaveBeenCalledWith(ROUTES.LOGIN_ERROR)
    expect(mockLogger.error).toHaveBeenCalledWith(
      'Azure AD login error:',
      expect.any(Error)
    )
  })
})

describe('azureAuth - Callback Handler - Success', () => {
  let mockServer
  let callbackHandler
  beforeEach(() => {
    vi.clearAllMocks()
    setupMockConfig()
    mockServer = {
      route: vi.fn((routes) => {
        const callbackRoute = routes.find((r) => r.path === ROUTES.CALLBACK)
        if (callbackRoute) {
          callbackHandler = callbackRoute.handler
        }
      })
    }
    azureAuth.plugin.register(mockServer)
  })
  test('Should exchange code for tokens and set session', async () => {
    mockMsalClient.acquireTokenByCode.mockResolvedValueOnce({
      account: {
        homeAccountId: TEST_CONSTANTS.USER_ID,
        username: TEST_CONSTANTS.USER_EMAIL,
        name: TEST_CONSTANTS.USER_NAME
      }
    })
    const setCookieAuth = vi.fn()
    const request = {
      query: { code: TEST_CONSTANTS.AUTH_CODE },
      auth: { credentials: null },
      cookieAuth: { set: setCookieAuth }
    }
    const h = {
      redirect: vi.fn((url) => ({ redirectTo: url }))
    }
    await callbackHandler(request, h)
    expect(mockMsalClient.acquireTokenByCode).toHaveBeenCalledWith({
      code: TEST_CONSTANTS.AUTH_CODE,
      scopes: ['openid', 'profile', 'email'],
      redirectUri: TEST_CONSTANTS.REDIRECT_URI
    })
    expect(setCookieAuth).toHaveBeenCalledWith({
      user: {
        id: TEST_CONSTANTS.USER_ID,
        email: TEST_CONSTANTS.USER_EMAIL,
        name: TEST_CONSTANTS.USER_NAME
      },
      isAuthenticated: true
    })
    expect(h.redirect).toHaveBeenCalledWith('/')
  })
})

describe('azureAuth - Callback Handler - Missing Code', () => {
  let mockServer
  let callbackHandler
  beforeEach(() => {
    vi.clearAllMocks()
    setupMockConfig()
    mockServer = {
      route: vi.fn((routes) => {
        const callbackRoute = routes.find((r) => r.path === ROUTES.CALLBACK)
        if (callbackRoute) {
          callbackHandler = callbackRoute.handler
        }
      })
    }
    azureAuth.plugin.register(mockServer)
  })
  test('Should redirect to error page when code is missing', async () => {
    const setCookieAuth = vi.fn()
    const request = {
      query: {},
      auth: { credentials: null },
      cookieAuth: { set: setCookieAuth }
    }
    const h = {
      redirect: vi.fn((url) => ({ redirectTo: url }))
    }
    await callbackHandler(request, h)
    expect(h.redirect).toHaveBeenCalledWith(ROUTES.INVALID_STATE)
    expect(mockLogger.error).toHaveBeenCalledWith(
      'No authorization code received on /auth/callback'
    )
  })
})

describe('azureAuth - Callback Handler - Session Restore', () => {
  let mockServer
  let callbackHandler
  beforeEach(() => {
    vi.clearAllMocks()
    setupMockConfig()
    mockServer = {
      route: vi.fn((routes) => {
        const callbackRoute = routes.find((r) => r.path === ROUTES.CALLBACK)
        if (callbackRoute) {
          callbackHandler = callbackRoute.handler
        }
      })
    }
    azureAuth.plugin.register(mockServer)
  })
  test('Should restore anonymous session on auth failure', async () => {
    mockMsalClient.acquireTokenByCode.mockRejectedValueOnce(
      new Error('Token error')
    )
    const setCookieAuth = vi.fn()
    const request = {
      query: { code: TEST_CONSTANTS.AUTH_CODE },
      auth: {
        credentials: {
          sid: TEST_CONSTANTS.SESSION_ID,
          isAuthenticated: false
        }
      },
      cookieAuth: { set: setCookieAuth }
    }
    const h = {
      redirect: vi.fn((url) => ({ redirectTo: url }))
    }
    await callbackHandler(request, h)
    expect(setCookieAuth).toHaveBeenCalledWith({
      sid: TEST_CONSTANTS.SESSION_ID,
      isAuthenticated: false
    })
    expect(mockLogger.info).toHaveBeenCalledWith(
      'Restoring anonymous session after failed auth attempt'
    )
    expect(h.redirect).toHaveBeenCalledWith(ROUTES.LOGIN_ERROR)
  })
  test('Should not restore session if user was authenticated', async () => {
    mockMsalClient.acquireTokenByCode.mockRejectedValueOnce(
      new Error('Token error')
    )
    const setCookieAuth = vi.fn()
    const request = {
      query: { code: TEST_CONSTANTS.AUTH_CODE },
      auth: {
        credentials: {
          sid: TEST_CONSTANTS.SESSION_ID,
          isAuthenticated: true
        }
      },
      cookieAuth: { set: setCookieAuth }
    }
    const h = {
      redirect: vi.fn((url) => ({ redirectTo: url }))
    }
    await callbackHandler(request, h)
    expect(setCookieAuth).not.toHaveBeenCalled()
    expect(h.redirect).toHaveBeenCalledWith(ROUTES.LOGIN_ERROR)
  })
})

describe('azureAuth - Logout Handler - Success', () => {
  let mockServer
  let logoutHandler
  beforeEach(() => {
    vi.clearAllMocks()
    setupMockConfig()
    mockServer = {
      route: vi.fn((routes) => {
        const logoutRoute = routes.find((r) => r.path === ROUTES.LOGOUT)
        if (logoutRoute) {
          logoutHandler = logoutRoute.handler
        }
      })
    }
    azureAuth.plugin.register(mockServer)
  })
  test('Should clear cookie and redirect to Azure AD logout', () => {
    const clearCookieAuth = vi.fn()
    const request = {
      query: {},
      cookieAuth: { clear: clearCookieAuth }
    }
    const h = {
      redirect: vi.fn((url) => ({ redirectTo: url }))
    }
    logoutHandler(request, h)
    expect(clearCookieAuth).toHaveBeenCalled()
    const expectedUri = `${TEST_CONSTANTS.POST_LOGOUT_URI}?confirmed=true`
    const expectedLogoutUri =
      `https://login.microsoftonline.com/${TEST_CONSTANTS.TENANT_ID}/oauth2/v2.0/logout` +
      `?post_logout_redirect_uri=${encodeURIComponent(expectedUri)}`
    expect(h.redirect).toHaveBeenCalledWith(expectedLogoutUri)
    expect(mockLogger.info).toHaveBeenCalledWith(
      'Redirecting to Azure AD logout'
    )
  })
  test('Should render logged-out view when confirmed', () => {
    const request = {
      query: { confirmed: 'true' },
      cookieAuth: { clear: vi.fn() }
    }
    const h = {
      view: vi.fn((template) => ({ template }))
    }
    logoutHandler(request, h)
    expect(h.view).toHaveBeenCalledWith('auth/logged-out')
  })
})

describe('azureAuth - Logout Handler - Edge Cases', () => {
  let mockServer
  let logoutHandler
  beforeEach(() => {
    vi.clearAllMocks()
    setupMockConfig()
    mockServer = {
      route: vi.fn((routes) => {
        const logoutRoute = routes.find((r) => r.path === ROUTES.LOGOUT)
        if (logoutRoute) {
          logoutHandler = logoutRoute.handler
        }
      })
    }
    azureAuth.plugin.register(mockServer)
  })
  test('Should handle missing tenant ID gracefully', () => {
    setupMockConfigWithoutTenant()
    const clearCookieAuth = vi.fn()
    const request = {
      query: {},
      cookieAuth: { clear: clearCookieAuth }
    }
    const h = {
      view: vi.fn((template) => ({ template }))
    }
    logoutHandler(request, h)
    expect(clearCookieAuth).toHaveBeenCalled()
    expect(h.view).toHaveBeenCalledWith('auth/logged-out')
    expect(mockLogger.warn).toHaveBeenCalledWith(
      'No AZURE_TENANT_ID – showing logout confirmation directly'
    )
  })
  test('Should handle cookie clear errors gracefully', () => {
    const clearCookieAuth = vi.fn(() => {
      throw new Error('Cookie error')
    })
    const request = {
      query: {},
      cookieAuth: { clear: clearCookieAuth }
    }
    const h = {
      redirect: vi.fn((url) => ({ redirectTo: url }))
    }
    expect(() => logoutHandler(request, h)).not.toThrow()
    expect(h.redirect).toHaveBeenCalled()
  })
})
