import { createHmac } from 'node:crypto'
import { config } from '../../../config/config.js'

/**
 * Generate HMAC-SHA256 signature for service authentication
 * Called on every frontend request to backend
 *
 * @param {string} method - HTTP method (e.g., 'POST', 'GET')
 * @param {string} path - Request path (e.g., '/api/review/text')
 * @returns {object} { token: string, timestamp: number }
 * @throws {Error} if BACKEND_SERVICE_TOKEN is not configured
 */
export function generateServiceToken(method, path) {
  const secret = config.get('backendServiceToken')
  if (!secret) {
    throw new Error(
      'BACKEND_SERVICE_TOKEN is not configured. Cannot generate service token.'
    )
  }

  const timestamp = Date.now()

  // Message format: METHOD:PATH:TIMESTAMP
  // This ensures token is specific to the request and includes timestamp for replay protection
  const message = `${method}:${path}:${timestamp}`

  const hmac = createHmac('sha256', secret)
  hmac.update(message)
  const token = hmac.digest('hex')

  return {
    token,
    timestamp
  }
}

/**
 * Get service token headers for a backend request
 * Convenience function that wraps generateServiceToken
 *
 * @param {string} method - HTTP method (e.g., 'POST', 'GET')
 * @param {string} path - Request path (e.g., '/api/review/text')
 * @returns {object} Headers object { 'x-service-token': string, 'x-timestamp': string }
 */
export function getServiceTokenHeaders(method, path) {
  const { token, timestamp } = generateServiceToken(method, path)

  return {
    'x-service-token': token,
    'x-timestamp': timestamp.toString()
  }
}
