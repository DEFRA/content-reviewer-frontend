import { describe, it, expect, vi, beforeEach } from 'vitest'
import { upload } from './index.js'
import { uploadController } from './controller.js'

vi.mock('./controller.js', () => ({
  uploadController: {
    showUploadForm: vi.fn(),
    initiateUpload: vi.fn()
  }
}))

describe('upload plugin', () => {
  let server
  let registeredRoutes
  const EXPECTED_ROUTE_COUNT = 3

  beforeEach(() => {
    vi.clearAllMocks()
    registeredRoutes = []
    server = {
      route: vi.fn((routes) => {
        registeredRoutes.push(...routes)
      })
    }
  })

  it('should have the correct plugin name', () => {
    expect(upload.plugin.name).toBe('upload')
  })

  it('should register all routes', async () => {
    await upload.plugin.register(server)
    expect(server.route).toHaveBeenCalledOnce()
    expect(registeredRoutes).toHaveLength(EXPECTED_ROUTE_COUNT)
  })
})

describe('upload plugin routes', () => {
  let server
  let registeredRoutes

  beforeEach(() => {
    vi.clearAllMocks()
    registeredRoutes = []
    server = {
      route: vi.fn((routes) => {
        registeredRoutes.push(...routes)
      })
    }
  })

  it('should register GET /upload route with showUploadForm handler', async () => {
    await upload.plugin.register(server)
    const route = registeredRoutes.find(
      (r) => r.method === 'GET' && r.path === '/upload'
    )
    expect(route).toBeDefined()
    expect(route.handler).toBe(uploadController.showUploadForm)
  })

  it('should register POST /upload/initiate route with initiateUpload handler', async () => {
    await upload.plugin.register(server)
    const route = registeredRoutes.find(
      (r) => r.method === 'POST' && r.path === '/upload/initiate'
    )
    expect(route).toBeDefined()
    expect(route.handler).toBe(uploadController.initiateUpload)
  })

  it('should register GET /upload/form route with inline handler', async () => {
    await upload.plugin.register(server)
    const route = registeredRoutes.find(
      (r) => r.method === 'GET' && r.path === '/upload/form'
    )
    expect(route).toBeDefined()
    const h = { view: vi.fn() }
    route.handler({}, h)
    expect(h.view).toHaveBeenCalledWith('upload/upload-form', {
      pageTitle: 'Upload Document',
      heading: 'Upload Your Document'
    })
  })
})
