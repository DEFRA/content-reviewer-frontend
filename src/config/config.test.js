import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// config.js evaluates module-level ternaries at import time, so we must
// reset modules and manipulate process.env before each dynamic import.

describe('config.js - production environment branches', () => {
  const origNodeEnv = process.env.NODE_ENV
  const origEnvironment = process.env.ENVIRONMENT

  beforeEach(() => {
    vi.resetModules()
  })

  afterEach(() => {
    process.env.NODE_ENV = origNodeEnv
    if (origEnvironment === undefined) {
      delete process.env.ENVIRONMENT
    } else {
      process.env.ENVIRONMENT = origEnvironment
    }
    vi.resetModules()
  })

  it('should set log.format to "ecs" in production', async () => {
    process.env.NODE_ENV = 'production'
    process.env.ENVIRONMENT = 'production'
    const { config } = await import('./config.js')
    expect(config.get('log.format')).toBe('ecs')
  })

  it('should set session.cache.engine to "redis" in production', async () => {
    process.env.NODE_ENV = 'production'
    process.env.ENVIRONMENT = 'production'
    const { config } = await import('./config.js')
    expect(config.get('session.cache.engine')).toBe('redis')
  })

  it('should set isProduction to true in production', async () => {
    process.env.NODE_ENV = 'production'
    const { config } = await import('./config.js')
    expect(config.get('isProduction')).toBe(true)
  })

  it('should set log.redact to non-empty array in production', async () => {
    process.env.NODE_ENV = 'production'
    process.env.ENVIRONMENT = 'production'
    const { config } = await import('./config.js')
    expect(config.get('log.redact')).toEqual(
      expect.arrayContaining(['req.headers.authorization'])
    )
  })
})

describe('config.js - development environment branches', () => {
  const origNodeEnv = process.env.NODE_ENV
  const origEnvironment = process.env.ENVIRONMENT

  beforeEach(() => {
    vi.resetModules()
  })

  afterEach(() => {
    process.env.NODE_ENV = origNodeEnv
    if (origEnvironment === undefined) {
      delete process.env.ENVIRONMENT
    } else {
      process.env.ENVIRONMENT = origEnvironment
    }
    vi.resetModules()
  })

  it('should set log.format to "pino-pretty" in development without ENVIRONMENT set', async () => {
    process.env.NODE_ENV = 'development'
    delete process.env.ENVIRONMENT
    const { config } = await import('./config.js')
    expect(config.get('log.format')).toBe('pino-pretty')
  })

  it('should set log.format to "ecs" in development when ENVIRONMENT is set', async () => {
    process.env.NODE_ENV = 'development'
    process.env.ENVIRONMENT = 'dev'
    const { config } = await import('./config.js')
    expect(config.get('log.format')).toBe('ecs')
  })

  it('should set session.cache.engine to "memory" in development', async () => {
    process.env.NODE_ENV = 'development'
    delete process.env.ENVIRONMENT
    const { config } = await import('./config.js')
    expect(config.get('session.cache.engine')).toBe('memory')
  })

  it('should set log.redact to empty array in development', async () => {
    process.env.NODE_ENV = 'development'
    delete process.env.ENVIRONMENT
    const { config } = await import('./config.js')
    expect(config.get('log.redact')).toEqual([])
  })

  it('should set isDevelopment to true in development', async () => {
    process.env.NODE_ENV = 'development'
    const { config } = await import('./config.js')
    expect(config.get('isDevelopment')).toBe(true)
  })
})
