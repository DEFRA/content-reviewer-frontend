import { describe, it, expect, vi } from 'vitest'
import { privacy } from './index.js'
import { privacyController } from './controller.js'

vi.mock('./controller.js', () => ({
  privacyController: { handler: vi.fn() }
}))

describe('privacy plugin', () => {
  it('should export a plugin with the correct name', () => {
    expect(privacy.plugin.name).toBe('privacy')
  })

  it('should register the GET /privacy route', () => {
    const mockServer = { route: vi.fn() }

    privacy.plugin.register(mockServer)

    expect(mockServer.route).toHaveBeenCalledOnce()
    expect(mockServer.route).toHaveBeenCalledWith([
      expect.objectContaining({
        method: 'GET',
        path: '/privacy',
        handler: privacyController.handler
      })
    ])
  })
})
