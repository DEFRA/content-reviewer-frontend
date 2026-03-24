import { describe, it, expect, vi } from 'vitest'

const ASSET_PATH = '/assets'
const CACHE_TIMEOUT = 3600000
const FAVICON_PATH = '/favicon.ico'
const NO_CONTENT = 204

const mockConfigGet = vi.fn((key) => {
  const values = {
    root: '/app',
    staticCacheTimeout: CACHE_TIMEOUT,
    assetPath: ASSET_PATH
  }
  return values[key] ?? null
})

vi.mock('../../../config/config.js', () => ({
  config: { get: mockConfigGet }
}))

vi.mock('../constants/status-codes.js', () => ({
  statusCodes: { noContent: NO_CONTENT }
}))

vi.mock('node:path', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    join: vi.fn((...parts) => parts.join('/').replace('//', '/'))
  }
})

const { serveStaticFiles } = await import('./serve-static-files.js')

function makeServer() {
  const routesSpy = vi.fn()
  return { route: routesSpy }
}

function getRegisteredRoutes(server) {
  serveStaticFiles.plugin.register(server)
  const [routes] = server.route.mock.calls[0]
  return routes
}

describe('serveStaticFiles - plugin shape', () => {
  it('exports an object with a plugin property', () => {
    expect(serveStaticFiles).toHaveProperty('plugin')
  })

  it('plugin has a name of staticFiles', () => {
    expect(serveStaticFiles.plugin.name).toBe('staticFiles')
  })

  it('plugin has a register function', () => {
    expect(typeof serveStaticFiles.plugin.register).toBe('function')
  })
})

describe('serveStaticFiles - server route registration', () => {
  it('registers two routes on the server', () => {
    const server = makeServer()
    const routes = getRegisteredRoutes(server)
    expect(routes).toHaveLength(2)
  })

  it('registers a GET route for /favicon.ico', () => {
    const server = makeServer()
    const routes = getRegisteredRoutes(server)
    const faviconRoute = routes.find((r) => r.path === FAVICON_PATH)
    expect(faviconRoute).toBeDefined()
    expect(faviconRoute.method).toBe('GET')
  })

  it('favicon route has auth disabled', () => {
    const server = makeServer()
    const routes = getRegisteredRoutes(server)
    const faviconRoute = routes.find((r) => r.path === FAVICON_PATH)
    expect(faviconRoute.options.auth).toBe(false)
  })

  it('favicon route sets cache with correct expiresIn', () => {
    const server = makeServer()
    const routes = getRegisteredRoutes(server)
    const faviconRoute = routes.find((r) => r.path === FAVICON_PATH)
    expect(faviconRoute.options.cache.expiresIn).toBe(CACHE_TIMEOUT)
    expect(faviconRoute.options.cache.privacy).toBe('public')
  })

  it('registers a GET route for the assets path', () => {
    const server = makeServer()
    const routes = getRegisteredRoutes(server)
    const assetRoute = routes.find((r) => r.path.includes(ASSET_PATH))
    expect(assetRoute).toBeDefined()
    expect(assetRoute.method).toBe('GET')
  })

  it('asset route has auth disabled', () => {
    const server = makeServer()
    const routes = getRegisteredRoutes(server)
    const assetRoute = routes.find((r) => r.path.includes(ASSET_PATH))
    expect(assetRoute.options.auth).toBe(false)
  })

  it('asset route directory handler uses the public path', () => {
    const server = makeServer()
    const routes = getRegisteredRoutes(server)
    const assetRoute = routes.find((r) => r.path.includes(ASSET_PATH))
    expect(assetRoute.handler.directory.path).toContain('.public')
  })

  it('asset route directory handler has redirectToSlash true', () => {
    const server = makeServer()
    const routes = getRegisteredRoutes(server)
    const assetRoute = routes.find((r) => r.path.includes(ASSET_PATH))
    expect(assetRoute.handler.directory.redirectToSlash).toBe(true)
  })
})

describe('serveStaticFiles - favicon handler', () => {
  it('returns a no-content response with image/x-icon type', () => {
    const server = makeServer()
    const routes = getRegisteredRoutes(server)
    const faviconRoute = routes.find((r) => r.path === FAVICON_PATH)

    const responseObj = {}
    const mockCode = vi.fn().mockReturnValue(responseObj)
    const mockType = vi.fn().mockReturnValue(responseObj)
    responseObj.code = mockCode
    responseObj.type = mockType

    const mockResponse = vi.fn().mockReturnValue(responseObj)
    const h = { response: mockResponse }

    faviconRoute.handler({}, h)

    expect(mockResponse).toHaveBeenCalledWith()
    expect(mockCode).toHaveBeenCalledWith(NO_CONTENT)
    expect(mockType).toHaveBeenCalledWith('image/x-icon')
  })
})
