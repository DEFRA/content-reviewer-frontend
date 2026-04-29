import { config } from '../../../config/config.js'
import { createLogger } from './logging/logger.js'

const logger = createLogger()

const SESSION_KEY = 'authTokens'

// Refresh the access token if it expires within this window
const REFRESH_THRESHOLD_MS = 60_000

function getTokens(request) {
  return request.yar?.get(SESSION_KEY) ?? {}
}

function setTokens(request, tokens) {
  request.yar?.set(SESSION_KEY, tokens)
}

/**
 * Call the backend refresh endpoint and update the session with the new token.
 * Returns the new access token string, or null on any failure.
 *
 * @param {import('@hapi/hapi').Request} request
 * @param {string} refreshToken
 * @returns {Promise<string|null>}
 */
async function silentRefresh(request, refreshToken) {
  if (!refreshToken) return null

  try {
    const backendUrl = config.get('backendUrl')
    const response = await fetch(`${backendUrl}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken })
    })

    if (!response.ok) {
      logger.warn({ status: response.status }, 'Silent token refresh failed')
      return null
    }

    const data = await response.json()
    if (!data.success || !data.accessToken) return null

    const existing = getTokens(request)
    setTokens(request, {
      ...existing,
      accessToken: data.accessToken,
      tokenExpiresAt: Date.now() + data.expiresIn * 1000
    })

    logger.info('Access token silently refreshed')
    return data.accessToken
  } catch (error) {
    logger.warn({ error: error.message }, 'Silent token refresh threw an error')
    return null
  }
}

/**
 * Drop-in replacement for fetch() that attaches a JWT Bearer token from the
 * Yar session and silently refreshes it when it is within 60 s of expiry.
 *
 * Use this for every server-side call from the frontend to the backend API.
 *
 * @param {import('@hapi/hapi').Request} request  - Hapi request (for session access)
 * @param {string} url                             - Backend URL to fetch
 * @param {RequestInit} [options]                  - Standard fetch options
 * @returns {Promise<Response>}
 */
export async function authenticatedFetch(request, url, options = {}) {
  const tokens = getTokens(request)
  let { accessToken, refreshToken, tokenExpiresAt } = tokens

  const shouldRefresh =
    !accessToken ||
    (tokenExpiresAt && Date.now() + REFRESH_THRESHOLD_MS > tokenExpiresAt)

  if (shouldRefresh && refreshToken) {
    const newToken = await silentRefresh(request, refreshToken)
    if (newToken) accessToken = newToken
  }

  return fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {})
    }
  })
}
