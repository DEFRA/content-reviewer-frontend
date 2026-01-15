import { createServer } from '../server.js'
import { statusCodes } from '../common/constants/status-codes.js'
import { vi } from 'vitest'

// Mock fetch to avoid making real backend requests during tests
global.fetch = vi.fn()

describe('#homeController', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  beforeEach(() => {
    // Mock fetch to return empty review history
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ reviews: [] })
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  test('Should provide expected response', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/'
    })

    expect(response.result).toEqual(expect.stringContaining('Home |'))
    expect(response.statusCode).toBe(statusCodes.ok)
  })
})
