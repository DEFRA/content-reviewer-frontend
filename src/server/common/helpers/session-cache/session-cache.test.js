import { describe, it, expect, vi, beforeEach } from 'vitest'

const MOCK_CACHE_NAME = 'session'
const MOCK_CACHE_TTL = 3600000
const MOCK_COOKIE_TTL = 3600000
const MOCK_COOKIE_PASSWORD = 'the-password-must-be-at-least-32-characters-long'
const MOCK_COOKIE_SECURE = false

// Mock the config module before importing session-cache
vi.mock('../../../../config/config.js', () => ({
  config: {
    get: vi.fn((key) => {
      if (key === 'session') {
        return {
          cache: {
            name: MOCK_CACHE_NAME,
            ttl: MOCK_CACHE_TTL
          },
          cookie: {
            password: MOCK_COOKIE_PASSWORD,
            ttl: MOCK_COOKIE_TTL
          }
        }
      }
      if (key === 'session.cookie.secure') {
        return MOCK_COOKIE_SECURE
      }
      return null
    })
  }
}))

vi.mock('@hapi/yar', () => ({
  default: { name: 'yar', version: '1.0.0' }
}))

describe('sessionCache', () => {
  let sessionCache

  beforeEach(async () => {
    // Re-import after mocks are set up
    const module = await import('./session-cache.js')
    sessionCache = module.sessionCache
  })

  it('should export a sessionCache object', () => {
    expect(sessionCache).toBeDefined()
  })

  it('should have a plugin property set to yar', () => {
    expect(sessionCache.plugin).toBeDefined()
    expect(sessionCache.plugin).toEqual({ name: 'yar', version: '1.0.0' })
  })

  it('should have options property', () => {
    expect(sessionCache.options).toBeDefined()
  })

  it('should prefix cookie name with __Host-', () => {
    expect(sessionCache.options.name).toBe(`__Host-${MOCK_CACHE_NAME}`)
  })

  it('should configure the cache with the correct name and TTL', () => {
    expect(sessionCache.options.cache).toEqual({
      cache: MOCK_CACHE_NAME,
      expiresIn: MOCK_CACHE_TTL
    })
  })

  it('should set storeBlank to false', () => {
    expect(sessionCache.options.storeBlank).toBe(false)
  })

  it('should set errorOnCacheNotReady to true', () => {
    expect(sessionCache.options.errorOnCacheNotReady).toBe(true)
  })

  it('should configure cookieOptions correctly', () => {
    const { cookieOptions } = sessionCache.options
    expect(cookieOptions.password).toBe(MOCK_COOKIE_PASSWORD)
    expect(cookieOptions.ttl).toBe(MOCK_COOKIE_TTL)
    expect(cookieOptions.isSecure).toBe(MOCK_COOKIE_SECURE)
    expect(cookieOptions.isSameSite).toBe('Lax')
    expect(cookieOptions.clearInvalid).toBe(true)
  })
})
