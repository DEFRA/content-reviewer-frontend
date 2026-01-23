import Blankie from 'blankie'

/**
 * Manage content security policies.
 * @satisfies {import('@hapi/hapi').Plugin}
 */
const contentSecurityPolicy = {
  plugin: Blankie,
  options: {
    // Hash 'sha256-GUQ5ad8JK5KmEWmROf3LZd9ge94daqNvd8xy9YS1iDw=' is to support a GOV.UK frontend script bundled within Nunjucks macros
    // https://frontend.design-system.service.gov.uk/import-javascript/#if-our-inline-javascript-snippet-is-blocked-by-a-content-security-policy
    defaultSrc: ['self'],
    fontSrc: ['self', 'data:'],
    // Allow connections to backend services in all environments
    connectSrc: [
      'self',
      'wss',
      'data:',
      'http://localhost:3001',
      'https://content-reviewer-backend.dev.cdp-int.defra.cloud',
      'https://content-reviewer-backend.test.cdp-int.defra.cloud',
      'https://content-reviewer-backend.perf-test.cdp-int.defra.cloud',
      'https://content-reviewer-backend.prod.cdp-int.defra.cloud'
    ],
    mediaSrc: ['self'],
    styleSrc: ['self', "'unsafe-inline'", "'unsafe-hashes'"],
    scriptSrc: [
      'self',
      "'sha256-GUQ5ad8JK5KmEWmROf3LZd9ge94daqNvd8xy9YS1iDw='"
    ],
    imgSrc: ['self', 'data:'],
    frameSrc: ['self', 'data:'],
    objectSrc: ['none'],
    frameAncestors: ['none'],
    formAction: ['self'],
    manifestSrc: ['self'],
    generateNonces: true
  }
}

export { contentSecurityPolicy }
