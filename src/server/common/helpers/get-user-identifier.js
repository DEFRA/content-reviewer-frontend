/**
 * Get the user identifier for authenticated users.
 * Returns the authenticated user's ID, or null for anonymous (not signed-in) users.
 * Anonymous users are not filtered — they see all reviews.
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
