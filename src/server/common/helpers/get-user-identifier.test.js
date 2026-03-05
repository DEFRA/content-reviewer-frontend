import { describe, it, expect } from 'vitest'
import { getUserIdentifier } from './get-user-identifier.js'

const SESSION_PREFIX = 'session:'

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

  it('returns a session-prefixed string when only a string sid is present', () => {
    const request = makeRequest({
      auth: { credentials: { sid: 'sid-xyz' } }
    })
    expect(getUserIdentifier(request)).toBe(`${SESSION_PREFIX}sid-xyz`)
  })

  it('extracts sid property from a session object with sid field', () => {
    const request = makeRequest({
      auth: { credentials: { sid: { sid: 'nested-sid' } } }
    })
    expect(getUserIdentifier(request)).toBe(`${SESSION_PREFIX}nested-sid`)
  })

  it('extracts id property from a session object with id field but no sid', () => {
    const request = makeRequest({
      auth: { credentials: { sid: { id: 'obj-id' } } }
    })
    expect(getUserIdentifier(request)).toBe(`${SESSION_PREFIX}obj-id`)
  })

  it('JSON-stringifies a session object with no sid or id field', () => {
    const sidObj = { token: 'tok-123' }
    const request = makeRequest({
      auth: { credentials: { sid: sidObj } }
    })
    expect(getUserIdentifier(request)).toBe(
      `${SESSION_PREFIX}${JSON.stringify(sidObj)}`
    )
  })

  it('JSON-stringifies a non-string, non-object sid value', () => {
    const request = makeRequest({
      auth: { credentials: { sid: 42 } }
    })
    expect(getUserIdentifier(request)).toBe(`${SESSION_PREFIX}42`)
  })

  it('returns null when auth credentials have no user id or sid', () => {
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
