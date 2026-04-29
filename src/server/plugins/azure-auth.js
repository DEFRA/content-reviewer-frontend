import { msalClient } from '../../config/azure-auth.js'
import { config } from '../../config/config.js'
import { createLogger } from '../common/helpers/logging/logger.js'

const logger = createLogger()

const AUTH_FAILED_REDIRECT = '/auth/login-page?error=auth_failed'
const AUTH_TOKENS_SESSION_KEY = 'authTokens'

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Call the backend login endpoint and store the returned JWT tokens in the
 * Yar server-side session.  Failures are non-fatal — the user remains logged in
 * via Azure AD; API calls will simply have no Bearer token until the next login.
 */
async function issueBackendTokens(request, { userId, email, name }) {
  try {
    const backendUrl = config.get('backendUrl')
    const response = await fetch(`${backendUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, email, name })
    })

    if (!response.ok) {
      logger.warn(
        { status: response.status },
        'Backend login request failed — no JWT tokens stored'
      )
      return
    }

    const data = await response.json()
    if (!data.success || !data.accessToken) {
      logger.warn(
        'Backend login returned unexpected payload — no JWT tokens stored'
      )
      return
    }

    request.yar.set(AUTH_TOKENS_SESSION_KEY, {
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      tokenExpiresAt: Date.now() + data.expiresIn * 1000
    })

    logger.info({ userId }, 'Backend JWT tokens stored in session')
  } catch (error) {
    logger.warn(
      { error: error.message },
      'Failed to obtain backend JWT tokens — proceeding without them'
    )
  }
}

// ── Route handlers ─────────────────────────────────────────────────────────────

/**
 * GET /auth/login
 * Builds the MSAL authorization URL and redirects the browser to
 * the Microsoft Entra ID login page.
 */
async function loginHandler(_request, h) {
  try {
    if (!msalClient) {
      logger.error(
        'MSAL client not initialised – missing AZURE_CLIENT_ID / AZURE_CLIENT_SECRET / AZURE_TENANT_ID'
      )
      return h.redirect(AUTH_FAILED_REDIRECT)
    }
    const authUrl = await msalClient.getAuthCodeUrl({
      scopes: ['openid', 'profile', 'email'],
      redirectUri: config.get('azure.redirectUri'),
      responseMode: 'query' // avoids form_post / SameSite cookie issues
    })
    logger.info('Redirecting to Azure AD login')
    return h.redirect(authUrl)
  } catch (error) {
    logger.error('Azure AD login error:', error)
    return h.redirect(AUTH_FAILED_REDIRECT)
  }
}

/**
 * GET /auth/callback
 * Azure AD redirects here with ?code=… after the user authenticates.
 * Exchanges the code for tokens, then stores the user in the session cookie.
 * On failure, redirects to the login page with an error.
 */
async function callbackHandler(request, h) {
  try {
    if (!msalClient) {
      logger.error('MSAL client not initialised – cannot process callback')
      return h.redirect(AUTH_FAILED_REDIRECT)
    }
    const code = request.query?.code
    if (!code) {
      logger.error('No authorization code received on /auth/callback')
      return h.redirect('/auth/login-page?error=invalid_state')
    }
    const response = await msalClient.acquireTokenByCode({
      code,
      scopes: ['openid', 'profile', 'email'],
      redirectUri: config.get('azure.redirectUri')
    })
    const account = response.account

    request.cookieAuth.set({
      user: {
        id: account.homeAccountId,
        email: account.username,
        name: account.name
      },
      isAuthenticated: true
    })

    // Obtain backend JWT tokens and store them in the server-side Yar session
    await issueBackendTokens(request, {
      userId: account.homeAccountId,
      email: account.username,
      name: account.name
    })

    logger.info(`User authenticated: ${account.username ?? 'unknown'}`)
    const returnTo = request.yar.get('returnTo') || '/'
    request.yar.clear('returnTo')
    return h.redirect(returnTo)
  } catch (error) {
    logger.error('Azure AD callback error:', error)
    return h.redirect(AUTH_FAILED_REDIRECT)
  }
}

/**
 * GET /auth/logout  (and ?confirmed=true for the Microsoft post-logout redirect)
 *
 * First visit  → clears local cookie → sends user to Microsoft logout →
 *               Microsoft redirects back here with ?confirmed=true
 * Return visit → renders the "You have been successfully logged out" page.
 *
 * AZURE_POST_LOGOUT_REDIRECT_URI must be registered in Azure App Registration:
 *   CDP:   https://content-reviewer-frontend.dev.cdp-int.defra.cloud/auth/logout
 *   Local: http://localhost:3000/auth/logout
 */
async function logoutHandler(request, h) {
  // Microsoft just redirected back after completing sign-out
  if (request.query?.confirmed === 'true') {
    return h.view('auth/logged-out')
  }

  // Revoke the backend refresh token so it can no longer be used
  try {
    const tokens = request.yar?.get(AUTH_TOKENS_SESSION_KEY)
    if (tokens?.refreshToken) {
      const backendUrl = config.get('backendUrl')
      await fetch(`${backendUrl}/api/auth/logout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: tokens.refreshToken })
      })
    }
  } catch {
    // Non-fatal — the refresh token will expire naturally
  }
  request.yar?.clear()

  // Clear the encrypted session cookie
  try {
    request.cookieAuth.clear()
  } catch {
    // Cookie may already be absent – ignore
  }

  const tenantId = config.get('azure.tenantId')
  if (tenantId) {
    const base = config.get('azure.postLogoutRedirectUri')
    const returnUri = `${base}?confirmed=true`
    const logoutUri =
      `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/logout` +
      `?post_logout_redirect_uri=${encodeURIComponent(returnUri)}`
    logger.info('Redirecting to Azure AD logout')
    return h.redirect(logoutUri)
  }

  // Fallback: Azure not configured (local dev without credentials)
  logger.warn('No AZURE_TENANT_ID – showing logout confirmation directly')
  return h.view('auth/logged-out')
}

// ── Plugin ────────────────────────────────────────────────────────────────────

export const azureAuth = {
  plugin: {
    name: 'azure-auth',
    register: (server) => {
      server.route([
        {
          method: 'GET',
          path: '/auth/login',
          options: { auth: false },
          handler: loginHandler
        },
        {
          method: 'GET',
          path: '/auth/callback',
          options: { auth: false },
          handler: callbackHandler
        },
        {
          method: 'GET',
          path: '/auth/logout',
          options: { auth: false },
          handler: logoutHandler
        }
      ])
    }
  }
}
