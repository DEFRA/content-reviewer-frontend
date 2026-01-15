import { createServer } from '../../server.js'

describe('#contentSecurityPolicy', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  test('Should set the CSP policy header', async () => {
    const resp = await server.inject({
      method: 'GET',
      url: '/'
    })

    // Check for either the standard CSP header or report-only version
    const cspHeader =
      resp.headers['content-security-policy'] ||
      resp.headers['content-security-policy-report-only']

    expect(cspHeader).toBeDefined()
    expect(typeof cspHeader).toBe('string')
    expect(cspHeader.length).toBeGreaterThan(0)
  })
})
