import { describe, it, expect, vi } from 'vitest'

const BACKEND_URL_HTTP = 'http://backend.example.com'
const BACKEND_URL_HTTPS = 'https://backend.example.com'
const CDP_UPLOADER_URL = 'https://cdp-uploader.example.com'

const mockConfigGet = vi.fn()
vi.mock('../../../config/config.js', () => ({
  config: { get: mockConfigGet }
}))

vi.mock('blankie', () => ({
  default: { name: 'blankie', register: vi.fn() }
}))

describe('contentSecurityPolicy - module shape', () => {
  it('exports a contentSecurityPolicy object with plugin and options', async () => {
    mockConfigGet.mockReturnValue(BACKEND_URL_HTTP)
    const { contentSecurityPolicy } =
      await import('./content-security-policy.js')
    expect(contentSecurityPolicy).toHaveProperty('plugin')
    expect(contentSecurityPolicy).toHaveProperty('options')
  })
})

describe('contentSecurityPolicy - connectSrc with http backend', () => {
  it('includes backendUrl and ws:// variant in connectSrc', async () => {
    vi.resetModules()
    mockConfigGet.mockReturnValue(BACKEND_URL_HTTP)
    const { contentSecurityPolicy } =
      await import('./content-security-policy.js')
    expect(contentSecurityPolicy.options.connectSrc).toContain(BACKEND_URL_HTTP)
    expect(contentSecurityPolicy.options.connectSrc).toContain(
      'ws://backend.example.com'
    )
  })
})

describe('contentSecurityPolicy - connectSrc with https backend', () => {
  it('includes backendUrl and wss:// variant in connectSrc', async () => {
    vi.resetModules()
    mockConfigGet.mockReturnValue(BACKEND_URL_HTTPS)
    const { contentSecurityPolicy } =
      await import('./content-security-policy.js')
    expect(contentSecurityPolicy.options.connectSrc).toContain(
      BACKEND_URL_HTTPS
    )
    expect(contentSecurityPolicy.options.connectSrc).toContain(
      'wss://backend.example.com'
    )
  })
})

describe('contentSecurityPolicy - static policy values', () => {
  it('sets defaultSrc to self', async () => {
    vi.resetModules()
    mockConfigGet.mockReturnValue(BACKEND_URL_HTTP)
    const { contentSecurityPolicy } =
      await import('./content-security-policy.js')
    expect(contentSecurityPolicy.options.defaultSrc).toEqual(['self'])
  })

  it('sets objectSrc to none', async () => {
    vi.resetModules()
    mockConfigGet.mockReturnValue(BACKEND_URL_HTTP)
    const { contentSecurityPolicy } =
      await import('./content-security-policy.js')
    expect(contentSecurityPolicy.options.objectSrc).toEqual(['none'])
  })

  it('sets frameAncestors to none', async () => {
    vi.resetModules()
    mockConfigGet.mockReturnValue(BACKEND_URL_HTTP)
    const { contentSecurityPolicy } =
      await import('./content-security-policy.js')
    expect(contentSecurityPolicy.options.frameAncestors).toEqual(['none'])
  })

  it('generates nonces only for scripts', async () => {
    vi.resetModules()
    mockConfigGet.mockReturnValue(BACKEND_URL_HTTP)
    const { contentSecurityPolicy } =
      await import('./content-security-policy.js')
    expect(contentSecurityPolicy.options.generateNonces).toBe('script')
  })

  it('includes the govuk-frontend sha256 hash in scriptSrc', async () => {
    vi.resetModules()
    mockConfigGet.mockReturnValue(BACKEND_URL_HTTP)
    const { contentSecurityPolicy } =
      await import('./content-security-policy.js')
    expect(contentSecurityPolicy.options.scriptSrc).toContain(
      "'sha256-GUQ5ad8JK5KmEWmROf3LZd9ge94daqNvd8xy9YS1iDw='"
    )
  })

  it('includes cdpUploaderUrl in formAction to allow form POST to CDP Uploader', async () => {
    vi.resetModules()
    mockConfigGet.mockImplementation((key) =>
      key === 'cdpUploader.url' ? CDP_UPLOADER_URL : BACKEND_URL_HTTP
    )
    const { contentSecurityPolicy } =
      await import('./content-security-policy.js')
    expect(contentSecurityPolicy.options.formAction).toContain(CDP_UPLOADER_URL)
  })
})
