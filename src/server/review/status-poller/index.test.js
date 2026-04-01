import { describe, it, expect, vi } from 'vitest'
import statusPollerPlugin from './index.js'
import { reviewStatusPollerController } from './controller.js'

vi.mock('./controller.js', () => ({
  reviewStatusPollerController: {
    showStatusPoller: vi.fn(),
    getReviewStatus: vi.fn()
  }
}))

vi.mock('undici', () => ({
  Agent: vi.fn().mockImplementation(() => ({}))
}))

describe('review-status-poller plugin', () => {
  it('should export a plugin with the correct name', () => {
    expect(statusPollerPlugin.plugin.name).toBe('review-status-poller')
  })

  it('should register the status-poller routes', async () => {
    const mockServer = { route: vi.fn() }

    await statusPollerPlugin.plugin.register(mockServer)

    expect(mockServer.route).toHaveBeenCalledOnce()
    expect(mockServer.route).toHaveBeenCalledWith([
      {
        method: 'GET',
        path: '/review/status-poller/{reviewId}',
        handler: reviewStatusPollerController.showStatusPoller
      },
      {
        method: 'GET',
        path: '/review/status/{reviewId}',
        handler: reviewStatusPollerController.getReviewStatus
      }
    ])
  })
})
