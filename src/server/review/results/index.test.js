import { describe, it, expect, vi } from 'vitest'
import reviewResultsPlugin from './index.js'
import { resultsController } from './controller.js'

vi.mock('./controller.js', () => ({
  resultsController: {
    handler: vi.fn()
  }
}))

describe('review-results plugin', () => {
  it('should export a plugin with correct name', () => {
    expect(reviewResultsPlugin.plugin.name).toBe('review-results')
  })

  it('should register routes correctly', async () => {
    const mockServer = {
      route: vi.fn()
    }

    await reviewResultsPlugin.plugin.register(mockServer)

    expect(mockServer.route).toHaveBeenCalledOnce()
    expect(mockServer.route).toHaveBeenCalledWith([
      {
        method: 'GET',
        path: '/review/results/{id}',
        handler: resultsController.handler
      }
    ])
  })

  it('should register GET route with correct path', async () => {
    const mockServer = {
      route: vi.fn()
    }

    await reviewResultsPlugin.plugin.register(mockServer)

    const routes = mockServer.route.mock.calls[0][0]
    const getRoute = routes[0]

    expect(getRoute).toBeDefined()
    expect(getRoute.method).toBe('GET')
    expect(getRoute.path).toBe('/review/results/{id}')
  })

  it('should register route with controller handler', async () => {
    const mockServer = {
      route: vi.fn()
    }

    await reviewResultsPlugin.plugin.register(mockServer)

    const routes = mockServer.route.mock.calls[0][0]
    const getRoute = routes[0]

    expect(getRoute.handler).toBe(resultsController.handler)
  })
})
