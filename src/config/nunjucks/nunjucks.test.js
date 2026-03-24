import { describe, it, expect, vi, beforeEach } from 'vitest'

// Hoisted mock factories
const {
  mockNunjucksConfigure,
  mockNunjucksCompile,
  mockAddGlobal,
  mockAddFilter,
  mockConfigGet,
  mockContextFn
} = vi.hoisted(() => {
  const addGlobal = vi.fn()
  const addFilter = vi.fn()
  const compile = vi.fn()
  return {
    mockNunjucksConfigure: vi.fn(() => ({ addGlobal, addFilter })),
    mockNunjucksCompile: compile,
    mockAddGlobal: addGlobal,
    mockAddFilter: addFilter,
    mockConfigGet: vi.fn(),
    mockContextFn: vi.fn()
  }
})

vi.mock('nunjucks', () => ({
  default: {
    configure: mockNunjucksConfigure,
    compile: mockNunjucksCompile
  }
}))

vi.mock('@hapi/vision', () => ({
  default: { name: 'vision', version: '7.0.0' }
}))

vi.mock('node:path', () => ({
  default: {
    dirname: vi.fn(() => '/mock/dir'),
    resolve: vi.fn((...args) => args.join('/'))
  }
}))

vi.mock('node:url', () => ({
  fileURLToPath: vi.fn(() => '/mock/dir/nunjucks.js')
}))

vi.mock('../config.js', () => ({
  config: { get: mockConfigGet }
}))

vi.mock('./context/context.js', () => ({
  context: mockContextFn
}))

vi.mock('./filters/filters.js', () => ({
  formatDate: vi.fn(),
  formatCurrency: vi.fn(),
  highlightContent: vi.fn(),
  renderUrlContent: vi.fn(),
  min: vi.fn(),
  assign: vi.fn()
}))

vi.mock('./globals/globals.js', () => ({
  govukRebrand: true
}))

const IS_PRODUCTION = false
const NUNJUCKS_WATCH = true
const NUNJUCKS_NO_CACHE = true

function setupConfig() {
  mockConfigGet.mockImplementation((key) => {
    const values = {
      'nunjucks.watch': NUNJUCKS_WATCH,
      'nunjucks.noCache': NUNJUCKS_NO_CACHE,
      isProduction: IS_PRODUCTION
    }
    return values[key] ?? null
  })
}

describe('nunjucksConfig - plugin registration', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    setupConfig()
    mockNunjucksConfigure.mockReturnValue({
      addGlobal: mockAddGlobal,
      addFilter: mockAddFilter
    })
  })

  it('should export nunjucksConfig with a plugin property', async () => {
    const { nunjucksConfig } = await import('./nunjucks.js')

    expect(nunjucksConfig).toHaveProperty('plugin')
  })

  it('should export nunjucksConfig with an options property', async () => {
    const { nunjucksConfig } = await import('./nunjucks.js')

    expect(nunjucksConfig).toHaveProperty('options')
  })

  it('should have njk engine in options.engines', async () => {
    const { nunjucksConfig } = await import('./nunjucks.js')

    expect(nunjucksConfig.options.engines).toHaveProperty('njk')
  })

  it('should have a compile function on the njk engine', async () => {
    const { nunjucksConfig } = await import('./nunjucks.js')

    expect(typeof nunjucksConfig.options.engines.njk.compile).toBe('function')
  })

  it('should include a compileOptions.environment', async () => {
    const { nunjucksConfig } = await import('./nunjucks.js')

    expect(nunjucksConfig.options.compileOptions).toHaveProperty('environment')
  })

  it('should set isCached to the isProduction config value', async () => {
    const { nunjucksConfig } = await import('./nunjucks.js')

    expect(nunjucksConfig.options.isCached).toBe(IS_PRODUCTION)
  })

  it('should set context to the imported context function', async () => {
    const { nunjucksConfig } = await import('./nunjucks.js')

    expect(nunjucksConfig.options.context).toBe(mockContextFn)
  })
})

describe('nunjucksConfig - compile function', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    setupConfig()
    mockNunjucksConfigure.mockReturnValue({
      addGlobal: mockAddGlobal,
      addFilter: mockAddFilter
    })
  })

  it('should call nunjucks.compile with src and the environment', async () => {
    const { nunjucksConfig } = await import('./nunjucks.js')
    const mockRender = vi.fn(() => '<p>rendered</p>')
    mockNunjucksCompile.mockReturnValue({ render: mockRender })

    const env = {}
    nunjucksConfig.options.engines.njk.compile('{{ name }}', {
      environment: env
    })

    expect(mockNunjucksCompile).toHaveBeenCalledWith('{{ name }}', env)
  })

  it('should return a render function from compile', async () => {
    const { nunjucksConfig } = await import('./nunjucks.js')
    const mockRender = vi.fn(() => '<p>hello</p>')
    mockNunjucksCompile.mockReturnValue({ render: mockRender })

    const renderFn = nunjucksConfig.options.engines.njk.compile('{{ x }}', {
      environment: {}
    })

    expect(typeof renderFn).toBe('function')
  })

  it('should call template.render when the returned function is invoked', async () => {
    const { nunjucksConfig } = await import('./nunjucks.js')
    const mockRender = vi.fn(() => '<p>hello</p>')
    mockNunjucksCompile.mockReturnValue({ render: mockRender })

    const renderFn = nunjucksConfig.options.engines.njk.compile('{{ x }}', {
      environment: {}
    })
    const ctx = { x: 'world' }
    renderFn(ctx)

    expect(mockRender).toHaveBeenCalledWith(ctx)
  })
})

describe('nunjucksConfig - globals and filters registration', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    setupConfig()
    mockNunjucksConfigure.mockReturnValue({
      addGlobal: mockAddGlobal,
      addFilter: mockAddFilter
    })
  })

  it('should call addGlobal for each exported global', async () => {
    await import('./nunjucks.js')

    expect(mockAddGlobal).toHaveBeenCalled()
  })

  it('should call addFilter for each exported filter', async () => {
    await import('./nunjucks.js')

    expect(mockAddFilter).toHaveBeenCalled()
  })

  it('should register govukRebrand as a global', async () => {
    await import('./nunjucks.js')

    const registeredNames = mockAddGlobal.mock.calls.map((c) => c[0])
    expect(registeredNames).toContain('govukRebrand')
  })

  it('should register formatDate as a filter', async () => {
    await import('./nunjucks.js')

    const registeredNames = mockAddFilter.mock.calls.map((c) => c[0])
    expect(registeredNames).toContain('formatDate')
  })

  it('should register formatCurrency as a filter', async () => {
    await import('./nunjucks.js')

    const registeredNames = mockAddFilter.mock.calls.map((c) => c[0])
    expect(registeredNames).toContain('formatCurrency')
  })
})
