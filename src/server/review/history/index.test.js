import { describe, it, expect, vi } from 'vitest'
import reviewHistoryPlugin from './index.js'
import { reviewHistoryController } from './controller.js'

vi.mock('./controller.js', () => ({
  reviewHistoryController: {
    showHistory: vi.fn(),
    deleteReview: vi.fn()
  }
}))

describe('review-history plugin', () => {
  it('should export a plugin with correct name', () => {
    expect(reviewHistoryPlugin.plugin.name).toBe('review-history')
  })

  it('should register routes correctly', async () => {
    const mockServer = {
      route: vi.fn()
    }

    await reviewHistoryPlugin.plugin.register(mockServer)

    expect(mockServer.route).toHaveBeenCalledOnce()
    expect(mockServer.route).toHaveBeenCalledWith([
      {
        method: 'GET',
        path: '/review/history',
        handler: reviewHistoryController.showHistory
      },
      {
        method: 'POST',
        path: '/review/history/{reviewId}/delete',
        handler: reviewHistoryController.deleteReview
      }
    ])
  })

  it('should register GET route with correct handler', async () => {
    const mockServer = {
      route: vi.fn()
    }

    await reviewHistoryPlugin.plugin.register(mockServer)

    const routes = mockServer.route.mock.calls[0][0]
    const getRoute = routes.find((r) => r.method === 'GET')

    expect(getRoute).toBeDefined()
    expect(getRoute.path).toBe('/review/history')
    expect(getRoute.handler).toBe(reviewHistoryController.showHistory)
  })

  it('should register POST route with correct handler', async () => {
    const mockServer = {
      route: vi.fn()
    }

    await reviewHistoryPlugin.plugin.register(mockServer)

    const routes = mockServer.route.mock.calls[0][0]
    const postRoute = routes.find((r) => r.method === 'POST')

    expect(postRoute).toBeDefined()
    expect(postRoute.path).toBe('/review/history/{reviewId}/delete')
    expect(postRoute.handler).toBe(reviewHistoryController.deleteReview)
  })
})
