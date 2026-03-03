/**
 * Get a consistent user identifier for both authenticated and anonymous users.
 * For authenticated users, returns their user ID.
 * For anonymous users, returns their session ID to track reviews per-session.
 *
 * @param {import('@hapi/hapi').Request} request - Hapi request object
 * @returns {string|null} User identifier (user ID or session ID)
 */
export function getUserIdentifier(request) {
  // First, try to get authenticated user ID
  const authenticatedUserId = request.auth?.credentials?.user?.id
  if (authenticatedUserId) {
    return authenticatedUserId
  }

  // For anonymous users, use session ID from the session credentials
  // After our fix, anonymous sessions have credentials with sid
  const sessionId = request.auth?.credentials?.sid
  if (sessionId) {
    // Use a prefix to distinguish session-based IDs from user IDs
    return `session:${sessionId}`
  }

  // Fallback: if no session exists yet (shouldn't happen after our fix)
  // This ensures each upload gets tracked even if session management fails
  return null
}
