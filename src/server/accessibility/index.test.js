import { describe, it, expect, vi } from 'vitest'
import { accessibility } from './index.js'
import { accessibilityController } from './controller.js'

vi.mock('./controller.js', () => ({
  accessibilityController: { handler: vi.fn() }
}))

describe('accessibility plugin', () => {
  it('should export a plugin with the correct name', () => {
    expect(accessibility.plugin.name).toBe('accessibility')
  })

  it('should register the GET /accessibility route', () => {
    const mockServer = { route: vi.fn() }

    accessibility.plugin.register(mockServer)

    expect(mockServer.route).toHaveBeenCalledOnce()
    expect(mockServer.route).toHaveBeenCalledWith([
      expect.objectContaining({
        method: 'GET',
        path: '/accessibility',
        handler: accessibilityController.handler
      })
    ])
  })
})
