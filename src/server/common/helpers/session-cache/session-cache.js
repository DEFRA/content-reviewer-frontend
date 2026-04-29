import yar from '@hapi/yar'

import { config } from '../../../../config/config.js'

const sessionConfig = config.get('session')

/**
 * Set options.maxCookieSize to 0 to always use server-side storage
 */
export const sessionCache = {
  plugin: yar,
  options: {
    name: '__Host-' + sessionConfig.cache.name, // __Host- prefix for enhanced security
    cache: {
      cache: sessionConfig.cache.name,
      expiresIn: sessionConfig.cache.ttl
    },
    storeBlank: false,
    errorOnCacheNotReady: false, // Redis not provisioned for this service; degrade gracefully instead of throwing 500
    cookieOptions: {
      password: sessionConfig.cookie.password,
      ttl: sessionConfig.cookie.ttl,
      isSecure: config.get('session.cookie.secure'),
      isSameSite: 'Lax', // Lax required for OAuth redirect flows (Strict blocks the callback)
      clearInvalid: true
    }
  }
}
