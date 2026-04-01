import { describe, it, expect, vi } from 'vitest'
import { cookies } from './index.js'
import { cookiesGetController, cookiesPostController } from './controller.js'

vi.mock('./controller.js', () => ({
  cookiesGetController: { handler: vi.fn() },
  cookiesPostController: { handler: vi.fn() },
  cookiesController: { handler: vi.fn() }
}))

describe('cookies plugin', () => {
  it('should export a plugin with the correct name', () => {
    expect(cookies.plugin.name).toBe('cookies')
  })

  it('should register GET and POST /cookies routes', () => {
    const mockServer = { route: vi.fn() }

    cookies.plugin.register(mockServer)

    expect(mockServer.route).toHaveBeenCalledOnce()
    expect(mockServer.route).toHaveBeenCalledWith([
      expect.objectContaining({
        method: 'GET',
        path: '/cookies',
        handler: cookiesGetController.handler
      }),
      expect.objectContaining({
        method: 'POST',
        path: '/cookies',
        handler: cookiesPostController.handler
      })
    ])
  })
})
