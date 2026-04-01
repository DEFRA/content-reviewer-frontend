import { describe, it, expect, vi } from 'vitest'
import { healthController } from './controller.js'

vi.mock('../common/constants/status-codes.js', () => ({
  statusCodes: { ok: 200 }
}))

describe('healthController', () => {
  it('should return success message with 200 status code', () => {
    const mockCodeFn = vi.fn()
    const h = {
      response: vi.fn().mockReturnValue({ code: mockCodeFn })
    }
    healthController.handler({}, h)
    expect(h.response).toHaveBeenCalledWith({ message: 'success' })
    expect(mockCodeFn).toHaveBeenCalledWith(200)
  })
})
