import { vi } from 'vitest'
import { statusCodes } from '../constants/status-codes.js'

describe('#serveStaticFiles', () => {
  let server

  describe('When secure context is disabled', () => {
    beforeAll(async () => {
      vi.resetModules()
      vi.stubEnv('PORT', '3098')
      const { startServer: startServerFn } = await import('./start-server.js')
      server = await startServerFn()
    }, 30000)

    afterAll(async () => {
      if (server) {
        await server.stop({ timeout: 0 })
      }
      vi.unstubAllEnvs()
    }, 30000)

    test('Should serve favicon as expected', async () => {
      const { statusCode } = await server.inject({
        method: 'GET',
        url: '/favicon.ico'
      })

      expect(statusCode).toBe(statusCodes.noContent)
    })

    test('Should serve assets as expected', async () => {
      // Note npm run build is ran in the postinstall hook in package.json to make sure there is always a file
      // available for this test. Remove as you see fit
      const { statusCode } = await server.inject({
        method: 'GET',
        url: '/public/assets/images/govuk-crest.svg'
      })

      expect(statusCode).toBe(statusCodes.ok)
    })
  })
})
