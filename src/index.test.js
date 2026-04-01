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

  it('should invoke the unhandledRejection handler and set exitCode to 1', async () => {
    vi.resetModules()
    mockStartServer.mockResolvedValue(undefined)

    const mockInfo = vi.fn()
    const mockError = vi.fn()
    mockCreateLogger.mockReturnValue({ info: mockInfo, error: mockError })

    await import('./index.js')

    const handlers = process.listeners('unhandledRejection')
    const handler = handlers.at(-1)

    const fakeError = new Error('test unhandled rejection')
    const originalExitCode = process.exitCode
    handler(fakeError)

    expect(mockInfo).toHaveBeenCalledWith('Unhandled rejection', {
      error: fakeError.message,
      stack: fakeError.stack
    })
    expect(mockError).toHaveBeenCalledWith(fakeError)
    expect(process.exitCode).toBe(1)

    // Restore
    process.exitCode = originalExitCode
  })
})
