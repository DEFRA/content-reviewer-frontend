import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as undici from 'undici'

const PROXY_URL = 'http://proxy.example.com:8080'

const { mockSetGlobalDispatcher, mockBootstrap, mockConfigGet } = vi.hoisted(
  () => ({
    mockSetGlobalDispatcher: vi.fn(),
    mockBootstrap: vi.fn(),
    mockConfigGet: vi.fn()
  })
)

vi.mock('undici', () => {
  const MockProxyAgent = vi.fn(function (url) {
    this.url = url
  })
  return {
    ProxyAgent: MockProxyAgent,
    setGlobalDispatcher: mockSetGlobalDispatcher
  }
})

vi.mock('global-agent', () => ({
  bootstrap: mockBootstrap
}))

vi.mock('../../../../config/config.js', () => ({
  config: { get: mockConfigGet }
}))

const { setupProxy } = await import('./setup-proxy.js')

describe('setupProxy - when no proxy is configured', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockConfigGet.mockReturnValue(null)
  })

  it('does not call setGlobalDispatcher when httpProxy is null', () => {
    setupProxy()
    expect(mockSetGlobalDispatcher).not.toHaveBeenCalled()
  })

  it('does not call bootstrap when httpProxy is null', () => {
    setupProxy()
    expect(mockBootstrap).not.toHaveBeenCalled()
  })

  it('does not construct a ProxyAgent when httpProxy is null', () => {
    setupProxy()
    expect(undici.ProxyAgent).not.toHaveBeenCalled()
  })
})

describe('setupProxy - when proxy is configured', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockConfigGet.mockReturnValue(PROXY_URL)
    globalThis.GLOBAL_AGENT = {}
  })

  it('creates a ProxyAgent with the proxy url', () => {
    setupProxy()
    expect(undici.ProxyAgent).toHaveBeenCalledWith(PROXY_URL)
  })

  it('calls setGlobalDispatcher with a ProxyAgent instance', () => {
    setupProxy()
    expect(mockSetGlobalDispatcher).toHaveBeenCalledOnce()
    const [arg] = mockSetGlobalDispatcher.mock.calls[0]
    expect(arg).toBeInstanceOf(undici.ProxyAgent)
  })

  it('calls bootstrap to set up global-agent', () => {
    setupProxy()
    expect(mockBootstrap).toHaveBeenCalled()
  })

  it('sets GLOBAL_AGENT.HTTP_PROXY to the proxy url', () => {
    setupProxy()
    expect(globalThis.GLOBAL_AGENT.HTTP_PROXY).toBe(PROXY_URL)
  })
})
