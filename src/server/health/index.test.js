import { describe, it, expect, vi } from 'vitest'
import { health } from './index.js'
import { healthController } from './controller.js'

vi.mock('./controller.js', () => ({
  healthController: { handler: vi.fn() }
}))

vi.mock('../common/constants/status-codes.js', () => ({
  statusCodes: { ok: 200 }
}))

describe('health plugin', () => {
  it('should export a plugin with the correct name', () => {
    expect(health.plugin.name).toBe('health')
  })

  it('should register the GET /health route', () => {
    const mockServer = { route: vi.fn() }

    health.plugin.register(mockServer)

    expect(mockServer.route).toHaveBeenCalledOnce()
    expect(mockServer.route).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'GET',
        path: '/health',
        handler: healthController.handler
      })
    )
  })
})
