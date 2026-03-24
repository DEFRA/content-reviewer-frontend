import { describe, it, expect, vi, beforeEach } from 'vitest'

// Hoisted mock factories
const {
  mockReadFileSync,
  mockConfigGet,
  mockBuildNavigation,
  mockLoggerWarn,
  mockLoggerError
} = vi.hoisted(() => ({
  mockReadFileSync: vi.fn(),
  mockConfigGet: vi.fn(),
  mockBuildNavigation: vi.fn(),
  mockLoggerWarn: vi.fn(),
  mockLoggerError: vi.fn()
}))

vi.mock('node:fs', () => ({
  readFileSync: mockReadFileSync
}))

vi.mock('../../config.js', () => ({
  config: { get: mockConfigGet }
}))

vi.mock('./build-navigation.js', () => ({
  buildNavigation: mockBuildNavigation
}))

vi.mock('../../../server/common/helpers/logging/logger.js', () => ({
  createLogger: () => ({
    warn: mockLoggerWarn,
    error: mockLoggerError
  })
}))

const ASSET_PATH = '/public'
const ROOT_PATH = '/app'
const SERVICE_NAME = 'Content Reviewer'
const BACKEND_URL = 'http://backend'
const MANIFEST_ASSET = 'main.js'
const MANIFEST_HASHED = 'main.abc123.js'
const UNKNOWN_ASSET = 'unknown.css'
const ASSET_BACK_LINK = 'back-link.js'
const NAV_STUB = [{ text: 'Home', href: '/', current: true }]
const CSP_NONCE = 'test-nonce-abc'

const MANIFEST_CONTENT = JSON.stringify({
  [MANIFEST_ASSET]: MANIFEST_HASHED,
  [ASSET_BACK_LINK]: 'back-link.xyz.js'
})

function makeRequest(overrides = {}) {
  return {
    path: '/',
    plugins: {},
    ...overrides
  }
}

function setupConfigMock() {
  mockConfigGet.mockImplementation((key) => {
    const values = {
      assetPath: ASSET_PATH,
      root: ROOT_PATH,
      serviceName: SERVICE_NAME,
      backendUrl: BACKEND_URL
    }
    return values[key] ?? null
  })
}

describe('context - webpack manifest loading', () => {
  beforeEach(() => {
    vi.resetModules()
    mockReadFileSync.mockReturnValue(MANIFEST_CONTENT)
    mockBuildNavigation.mockReturnValue(NAV_STUB)
    setupConfigMock()
  })

  it('should read the manifest on first call', async () => {
    const { context } = await import('./context.js')
    context(makeRequest())

    expect(mockReadFileSync).toHaveBeenCalledTimes(1)
  })

  it('should not re-read the manifest on subsequent calls', async () => {
    const { context } = await import('./context.js')
    context(makeRequest())
    context(makeRequest())

    expect(mockReadFileSync).toHaveBeenCalledTimes(1)
  })

  it('should throw and log when manifest file cannot be read', async () => {
    const manifestError = new Error('ENOENT')
    mockReadFileSync.mockImplementation(() => {
      throw manifestError
    })
    const { context } = await import('./context.js')

    expect(() => context(makeRequest())).toThrow('ENOENT')
    expect(mockLoggerError).toHaveBeenCalled()
  })
})

describe('context - returned object shape', () => {
  beforeEach(() => {
    vi.resetModules()
    mockReadFileSync.mockReturnValue(MANIFEST_CONTENT)
    mockBuildNavigation.mockReturnValue(NAV_STUB)
    setupConfigMock()
  })

  it('should return assetPath with /assets appended', async () => {
    const { context } = await import('./context.js')
    const result = context(makeRequest())

    expect(result.assetPath).toBe(`${ASSET_PATH}/assets`)
  })

  it('should return the configured serviceName', async () => {
    const { context } = await import('./context.js')
    const result = context(makeRequest())

    expect(result.serviceName).toBe(SERVICE_NAME)
  })

  it('should return serviceUrl as /', async () => {
    const { context } = await import('./context.js')
    const result = context(makeRequest())

    expect(result.serviceUrl).toBe('/')
  })

  it('should return empty breadcrumbs array', async () => {
    const { context } = await import('./context.js')
    const result = context(makeRequest())

    expect(result.breadcrumbs).toEqual([])
  })

  it('should return the configured backendUrl', async () => {
    const { context } = await import('./context.js')
    const result = context(makeRequest())

    expect(result.backendUrl).toBe(BACKEND_URL)
  })

  it('should delegate navigation to buildNavigation', async () => {
    const { context } = await import('./context.js')
    const request = makeRequest()
    const result = context(request)

    expect(result.navigation).toEqual(NAV_STUB)
    expect(mockBuildNavigation).toHaveBeenCalledWith(request)
  })
})

describe('context - cspNonce', () => {
  beforeEach(() => {
    vi.resetModules()
    mockReadFileSync.mockReturnValue(MANIFEST_CONTENT)
    mockBuildNavigation.mockReturnValue(NAV_STUB)
    setupConfigMock()
  })

  it('should read cspNonce from request.plugins.blankie.nonces.script', async () => {
    const { context } = await import('./context.js')
    const request = makeRequest({
      plugins: { blankie: { nonces: { script: CSP_NONCE } } }
    })
    const result = context(request)

    expect(result.cspNonce).toBe(CSP_NONCE)
  })

  it('should default cspNonce to empty string when not present', async () => {
    const { context } = await import('./context.js')
    const result = context(makeRequest())

    expect(result.cspNonce).toBe('')
  })

  it('should default cspNonce to empty string when plugins is empty', async () => {
    const { context } = await import('./context.js')
    const request = makeRequest({ plugins: {} })
    const result = context(request)

    expect(result.cspNonce).toBe('')
  })
})

describe('context - getAssetPath', () => {
  beforeEach(() => {
    vi.resetModules()
    mockReadFileSync.mockReturnValue(MANIFEST_CONTENT)
    mockBuildNavigation.mockReturnValue(NAV_STUB)
    setupConfigMock()
  })

  it('should return the hashed asset path from the manifest', async () => {
    const { context } = await import('./context.js')
    const result = context(makeRequest())

    expect(result.getAssetPath(MANIFEST_ASSET)).toBe(
      `${ASSET_PATH}/${MANIFEST_HASHED}`
    )
  })

  it('should fall back to the asset name when not in manifest', async () => {
    const { context } = await import('./context.js')
    const result = context(makeRequest())

    expect(result.getAssetPath(UNKNOWN_ASSET)).toBe(
      `${ASSET_PATH}/${UNKNOWN_ASSET}`
    )
  })
})
