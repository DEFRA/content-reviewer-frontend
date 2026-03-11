import { describe, it, expect } from 'vitest'
import { getUserIdentifier } from './get-user-identifier.js'

function makeRequest(overrides = {}) {
  return { auth: { credentials: {}, ...overrides.auth }, ...overrides }
}

describe('getUserIdentifier', () => {
  it('returns the authenticated user id when present', () => {
    const request = makeRequest({
      auth: { credentials: { user: { id: 'user-abc' } } }
    })
    expect(getUserIdentifier(request)).toBe('user-abc')
  })

  it('returns null when auth credentials have no user id (anonymous user)', () => {
    const request = makeRequest({ auth: { credentials: {} } })
    expect(getUserIdentifier(request)).toBeNull()
  })

  it('returns null when auth credentials are absent', () => {
    const request = { auth: {} }
    expect(getUserIdentifier(request)).toBeNull()
  })

  it('returns null when auth is absent', () => {
    const request = {}
    expect(getUserIdentifier(request)).toBeNull()
  })
})
