import { describe, it, expect, vi } from 'vitest'
import { about } from './index.js'
import { aboutController } from './controller.js'

vi.mock('./controller.js', () => ({
  aboutController: { handler: vi.fn() }
}))

describe('about plugin', () => {
  it('should export a plugin with the correct name', () => {
    expect(about.plugin.name).toBe('about')
  })

  it('should register the GET /about route', () => {
    const mockServer = { route: vi.fn() }

    about.plugin.register(mockServer)

    expect(mockServer.route).toHaveBeenCalledOnce()
    expect(mockServer.route).toHaveBeenCalledWith([
      expect.objectContaining({
        method: 'GET',
        path: '/about',
        handler: aboutController.handler
      })
    ])
  })
})
