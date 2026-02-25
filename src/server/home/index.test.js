import { describe, it, expect, beforeEach } from 'vitest'
import { home } from './index.js'

describe('home plugin', () => {
  let mockServer

  beforeEach(() => {
    mockServer = {
      route: () => {}
    }
  })

  it('should export a plugin object', () => {
    expect(home).toBeDefined()
    expect(home.plugin).toBeDefined()
    expect(home.plugin.name).toBe('home')
    expect(typeof home.plugin.register).toBe('function')
  })

  it('should register home route', () => {
    const routes = []
    mockServer.route = (routeConfig) => {
      routes.push(...routeConfig)
    }

    home.plugin.register(mockServer)

    expect(routes).toHaveLength(1)
    expect(routes[0].method).toBe('GET')
    expect(routes[0].path).toBe('/')
    expect(routes[0].handler).toBeDefined()
  })
})
