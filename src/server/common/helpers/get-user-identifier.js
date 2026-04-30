/**
 * Get the user identifier for the authenticated user.
 * Returns the authenticated user's ID, or null if credentials are absent.
 *
 * @param {import('@hapi/hapi').Request} request - Hapi request object
 * @returns {string|null} Authenticated user ID, or null
 */
export function getUserIdentifier(request) {
  const authenticatedUserId = request.auth?.credentials?.user?.id
  if (authenticatedUserId) {
    return authenticatedUserId
  }
  return null
}
