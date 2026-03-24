import { describe, it, expect, vi, beforeEach } from 'vitest'

// Hoisted mock factories
const {
  mockConfidentialClientApplication,
  mockConfigGet,
  mockLoggerWarn,
  mockLoggerDebug
} = vi.hoisted(() => ({
  mockConfidentialClientApplication: vi.fn(function (cfg) {
    this.config = cfg
  }),
  mockConfigGet: vi.fn(),
  mockLoggerWarn: vi.fn(),
  mockLoggerDebug: vi.fn()
}))

vi.mock('@azure/msal-node', () => ({
  ConfidentialClientApplication: mockConfidentialClientApplication
}))

vi.mock('./config.js', () => ({
  config: { get: mockConfigGet }
}))

vi.mock('../server/common/helpers/logging/logger.js', () => ({
  createLogger: () => ({
    warn: mockLoggerWarn,
    debug: mockLoggerDebug
  })
}))

const VALID_CLIENT_ID = 'client-id-123'
const VALID_CLIENT_SECRET = 'secret-abc'
const VALID_TENANT_ID = 'tenant-xyz'
const AUTHORITY_BASE = 'https://login.microsoftonline.com/'
const MSAL_LEVEL = 'Warning'
const MSAL_MESSAGE = 'some MSAL message'

function setupValidConfig() {
  mockConfigGet.mockImplementation((key) => {
    const values = {
      'azure.clientId': VALID_CLIENT_ID,
      'azure.clientSecret': VALID_CLIENT_SECRET,
      'azure.tenantId': VALID_TENANT_ID
    }
    return values[key] ?? null
  })
}

function setupMissingClientId() {
  mockConfigGet.mockImplementation((key) => {
    const values = {
      'azure.clientSecret': VALID_CLIENT_SECRET,
      'azure.tenantId': VALID_TENANT_ID
    }
    return values[key] ?? null
  })
}

function setupMissingClientSecret() {
  mockConfigGet.mockImplementation((key) => {
    const values = {
      'azure.clientId': VALID_CLIENT_ID,
      'azure.tenantId': VALID_TENANT_ID
    }
    return values[key] ?? null
  })
}

function setupMissingAllCredentials() {
  mockConfigGet.mockReturnValue(null)
}

describe('azure-auth - valid credentials', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    setupValidConfig()
  })

  it('should create msalClient when all credentials are present', async () => {
    const { msalClient } = await import('./azure-auth.js')

    expect(msalClient).not.toBeNull()
    expect(mockConfidentialClientApplication).toHaveBeenCalledTimes(1)
  })

  it('should not log warnings when all credentials are present', async () => {
    await import('./azure-auth.js')

    expect(mockLoggerWarn).not.toHaveBeenCalled()
  })

  it('should set correct clientId in msalConfig.auth', async () => {
    const { msalConfig } = await import('./azure-auth.js')

    expect(msalConfig.auth.clientId).toBe(VALID_CLIENT_ID)
  })

  it('should set correct authority in msalConfig.auth', async () => {
    const { msalConfig } = await import('./azure-auth.js')

    expect(msalConfig.auth.authority).toBe(
      `${AUTHORITY_BASE}${VALID_TENANT_ID}`
    )
  })

  it('should set correct clientSecret in msalConfig.auth', async () => {
    const { msalConfig } = await import('./azure-auth.js')

    expect(msalConfig.auth.clientSecret).toBe(VALID_CLIENT_SECRET)
  })

  it('should set piiLoggingEnabled to false', async () => {
    const { msalConfig } = await import('./azure-auth.js')

    expect(msalConfig.system.loggerOptions.piiLoggingEnabled).toBe(false)
  })

  it('loggerCallback should call logger.debug', async () => {
    const { msalConfig } = await import('./azure-auth.js')
    msalConfig.system.loggerOptions.loggerCallback(MSAL_LEVEL, MSAL_MESSAGE)

    expect(mockLoggerDebug).toHaveBeenCalledWith(
      `MSAL [${MSAL_LEVEL}]: ${MSAL_MESSAGE}`
    )
  })
})

describe('azure-auth - missing clientId', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    setupMissingClientId()
  })

  it('should warn when clientId is missing', async () => {
    await import('./azure-auth.js')

    expect(mockLoggerWarn).toHaveBeenCalledWith(
      expect.stringContaining('AZURE_CLIENT_ID')
    )
  })

  it('should set msalClient to null when clientId is missing', async () => {
    const { msalClient } = await import('./azure-auth.js')

    expect(msalClient).toBeNull()
  })

  it('should use empty string for clientId in msalConfig.auth', async () => {
    const { msalConfig } = await import('./azure-auth.js')

    expect(msalConfig.auth.clientId).toBe('')
  })

  it('should use common authority when tenantId is missing', async () => {
    vi.resetModules()
    vi.clearAllMocks()
    // Only clientSecret present — both clientId and tenantId are absent
    mockConfigGet.mockImplementation((key) => {
      if (key === 'azure.clientSecret') {
        return VALID_CLIENT_SECRET
      }
      return null
    })
    const { msalConfig } = await import('./azure-auth.js')

    expect(msalConfig.auth.authority).toBe(`${AUTHORITY_BASE}common`)
  })
})

describe('azure-auth - missing clientSecret', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    setupMissingClientSecret()
  })

  it('should warn when clientSecret is missing', async () => {
    await import('./azure-auth.js')

    expect(mockLoggerWarn).toHaveBeenCalledWith(
      expect.stringContaining('AZURE_CLIENT_SECRET')
    )
  })

  it('should set msalClient to null when clientSecret is missing', async () => {
    const { msalClient } = await import('./azure-auth.js')

    expect(msalClient).toBeNull()
  })
})

describe('azure-auth - all credentials missing', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    setupMissingAllCredentials()
  })

  it('should warn about missing client id and tenant id', async () => {
    await import('./azure-auth.js')

    const warnCalls = mockLoggerWarn.mock.calls.map((c) => c[0])
    expect(warnCalls.some((msg) => msg.includes('AZURE_CLIENT_ID'))).toBe(true)
  })

  it('should warn about missing client secret', async () => {
    await import('./azure-auth.js')

    const warnCalls = mockLoggerWarn.mock.calls.map((c) => c[0])
    expect(warnCalls.some((msg) => msg.includes('AZURE_CLIENT_SECRET'))).toBe(
      true
    )
  })

  it('should set msalClient to null', async () => {
    const { msalClient } = await import('./azure-auth.js')

    expect(msalClient).toBeNull()
  })
})
