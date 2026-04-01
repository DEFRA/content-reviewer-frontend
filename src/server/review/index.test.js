import { describe, it, expect, vi } from 'vitest'
import reviewPlugin from './index.js'

const mockStatusPollerPlugin = {
  plugin: { name: 'review-status-poller', register: vi.fn() }
}
const mockResultsPlugin = {
  plugin: { name: 'review-results', register: vi.fn() }
}
const mockHistoryPlugin = {
  plugin: { name: 'review-history', register: vi.fn() }
}

vi.mock('./status-poller/index.js', () => ({ default: mockStatusPollerPlugin }))
vi.mock('./results/index.js', () => ({ default: mockResultsPlugin }))
vi.mock('./history/index.js', () => ({ default: mockHistoryPlugin }))

describe('review plugin', () => {
  it('should export a plugin with the correct name', () => {
    expect(reviewPlugin.plugin.name).toBe('review')
  })

  it('should register all three sub-plugins', async () => {
    const mockServer = { register: vi.fn().mockResolvedValue(undefined) }

    await reviewPlugin.plugin.register(mockServer)

    expect(mockServer.register).toHaveBeenCalledOnce()
    expect(mockServer.register).toHaveBeenCalledWith([
      { plugin: mockStatusPollerPlugin },
      { plugin: mockResultsPlugin },
      { plugin: mockHistoryPlugin }
    ])
  })
})
