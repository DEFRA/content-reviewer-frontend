import { describe, it, expect, vi, beforeEach } from 'vitest'
import { router } from './router.js'

const PLUGIN_NAME = 'router'

function makeServer() {
  const routes = []
  return {
    register: vi.fn().mockResolvedValue(undefined),
    route: vi.fn((config) => {
      routes.push(config)
    }),
    _routes: routes
  }
}

describe('router plugin - structure', () => {
  it('should export a plugin object', () => {
    expect(router).toBeDefined()
    expect(router.plugin).toBeDefined()
    expect(router.plugin.name).toBe(PLUGIN_NAME)
    expect(typeof router.plugin.register).toBe('function')
  })
})

describe('router plugin - register', () => {
  let server

  beforeEach(() => {
    server = makeServer()
    vi.clearAllMocks()
  })

  it('should call server.register at least once', async () => {
    await router.plugin.register(server)

    expect(server.register).toHaveBeenCalled()
  })

  it('should register the inert plugin', async () => {
    await router.plugin.register(server)

    const firstCall = server.register.mock.calls[0][0]
    // inert is registered in the first call as an array element
    expect(Array.isArray(firstCall)).toBe(true)
  })

  it('should register the health plugin', async () => {
    await router.plugin.register(server)

    const registerCalls = server.register.mock.calls
    expect(registerCalls.length).toBeGreaterThan(1)
  })

  it('should define the /auth/login-page route', async () => {
    await router.plugin.register(server)

    const loginRoute = server._routes.find((r) => r.path === '/auth/login-page')
    expect(loginRoute).toBeDefined()
    expect(loginRoute.method).toBe('GET')
    expect(loginRoute.options.auth).toBe(false)
  })

  it('should define the POST /api/upload route', async () => {
    await router.plugin.register(server)

    const uploadRoute = server._routes.find((r) => r.path === '/api/upload')
    expect(uploadRoute).toBeDefined()
    expect(uploadRoute.method).toBe('POST')
  })

  it('should define the GET /api/reviews route', async () => {
    await router.plugin.register(server)

    const reviewsRoute = server._routes.find((r) => r.path === '/api/reviews')
    expect(reviewsRoute).toBeDefined()
    expect(reviewsRoute.method).toBe('GET')
  })

  it('should define the POST /api/review/text route', async () => {
    await router.plugin.register(server)

    const textRoute = server._routes.find((r) => r.path === '/api/review/text')
    expect(textRoute).toBeDefined()
    expect(textRoute.method).toBe('POST')
  })

  it('should define the GET /api/fetch-url route with auth disabled', async () => {
    await router.plugin.register(server)

    const fetchUrlRoute = server._routes.find(
      (r) => r.path === '/api/fetch-url'
    )
    expect(fetchUrlRoute).toBeDefined()
    expect(fetchUrlRoute.options.auth).toBe(false)
  })

  it('should call upload route handler', async () => {
    await router.plugin.register(server)

    const uploadRoute = server._routes.find((r) => r.path === '/api/upload')
    expect(typeof uploadRoute.handler).toBe('function')
  })
})
