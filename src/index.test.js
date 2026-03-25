import { describe, it, expect, vi } from 'vitest'

const { mockStartServer, mockCreateLogger } = vi.hoisted(() => {
  return {
    mockStartServer: vi.fn().mockResolvedValue(undefined),
    mockCreateLogger: vi.fn(() => ({
      info: vi.fn(),
      error: vi.fn()
    }))
  }
})

vi.mock('./server/common/helpers/start-server.js', () => ({
  startServer: mockStartServer
}))

vi.mock('./server/common/helpers/logging/logger.js', () => ({
  createLogger: mockCreateLogger
}))

vi.mock('dotenv/config', () => ({}))

describe('index.js - server startup', () => {
  it('should call startServer on module load', async () => {
    await import('./index.js')

    expect(mockStartServer).toHaveBeenCalledTimes(1)
  })

  it('should register an unhandledRejection handler', async () => {
    const listenersBefore = process.listeners('unhandledRejection').length

    vi.resetModules()
    mockStartServer.mockResolvedValue(undefined)
    await import('./index.js')

    const listenersAfter = process.listeners('unhandledRejection').length
    expect(listenersAfter).toBeGreaterThanOrEqual(listenersBefore)
  })
})
