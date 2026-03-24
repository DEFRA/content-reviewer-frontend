import { describe, it, expect } from 'vitest'
import { buildNavigation } from './build-navigation.js'

const HOME_TEXT = 'Home'
const HOME_HREF = '/'
const ABOUT_TEXT = 'About'
const ABOUT_HREF = '/about'
const OTHER_PATH = '/other'
const HOME_INDEX = 0
const ABOUT_INDEX = 1

describe('buildNavigation - home path', () => {
  it('should mark Home as current when path is /', () => {
    const request = { path: HOME_HREF }
    const nav = buildNavigation(request)

    expect(nav[HOME_INDEX].current).toBe(true)
    expect(nav[ABOUT_INDEX].current).toBe(false)
  })

  it('should return correct text and href for Home', () => {
    const request = { path: HOME_HREF }
    const nav = buildNavigation(request)

    expect(nav[HOME_INDEX].text).toBe(HOME_TEXT)
    expect(nav[HOME_INDEX].href).toBe(HOME_HREF)
  })
})

describe('buildNavigation - about path', () => {
  it('should mark About as current when path is /about', () => {
    const request = { path: ABOUT_HREF }
    const nav = buildNavigation(request)

    expect(nav[HOME_INDEX].current).toBe(false)
    expect(nav[ABOUT_INDEX].current).toBe(true)
  })

  it('should return correct text and href for About', () => {
    const request = { path: ABOUT_HREF }
    const nav = buildNavigation(request)

    expect(nav[ABOUT_INDEX].text).toBe(ABOUT_TEXT)
    expect(nav[ABOUT_INDEX].href).toBe(ABOUT_HREF)
  })
})

describe('buildNavigation - other paths', () => {
  it('should mark neither as current for unrelated paths', () => {
    const request = { path: OTHER_PATH }
    const nav = buildNavigation(request)

    expect(nav[HOME_INDEX].current).toBe(false)
    expect(nav[ABOUT_INDEX].current).toBe(false)
  })

  it('should return two nav items', () => {
    const request = { path: OTHER_PATH }
    const nav = buildNavigation(request)

    expect(nav).toHaveLength(2)
  })
})

describe('buildNavigation - null/undefined request', () => {
  it('should handle null request gracefully', () => {
    const nav = buildNavigation(null)

    expect(nav[HOME_INDEX].current).toBe(false)
    expect(nav[ABOUT_INDEX].current).toBe(false)
  })

  it('should handle undefined request gracefully', () => {
    const nav = buildNavigation(undefined)

    expect(nav[HOME_INDEX].current).toBe(false)
    expect(nav[ABOUT_INDEX].current).toBe(false)
  })

  it('should handle request with no path property', () => {
    const nav = buildNavigation({})

    expect(nav[HOME_INDEX].current).toBe(false)
    expect(nav[ABOUT_INDEX].current).toBe(false)
  })
})
