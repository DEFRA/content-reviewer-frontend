import { msalClient } from '../../config/azure-auth.js'
import { config } from '../../config/config.js'
import { createLogger } from '../common/helpers/logging/logger.js'

const logger = createLogger()

const AUTH_FAILED_REDIRECT = '/auth/login-page?error=auth_failed'

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
 * If authentication fails, preserve the anonymous session so review history is not lost.
 */
function restoreAnonymousSession(request, existingSession) {
  if (existingSession?.sid && !existingSession?.isAuthenticated) {
    request.cookieAuth.set(existingSession)
    return true
  }
  return false
}

async function callbackHandler(request, h) {
  // Preserve the existing anonymous session in case authentication fails
  const existingSession = request.auth?.credentials || null

  try {
    if (!msalClient) {
      logger.error('MSAL client not initialised – cannot process callback')
      // Restore anonymous session if it existed
      restoreAnonymousSession(request, existingSession)
      return h.redirect(AUTH_FAILED_REDIRECT)
    }
    const code = request.query?.code
    if (!code) {
      logger.error('No authorization code received on /auth/callback')
      // Restore anonymous session if it existed
      restoreAnonymousSession(request, existingSession)
      return h.redirect('/auth/login-page?error=invalid_state')
    }
    const response = await msalClient.acquireTokenByCode({
      code,
      scopes: ['openid', 'profile', 'email'],
      redirectUri: config.get('azure.redirectUri')
    })
    const account = response.account

    // Only set authenticated session if successful
    request.cookieAuth.set({
      user: {
        id: account.homeAccountId,
        email: account.username,
        name: account.name
      },
      isAuthenticated: true
    })
    logger.info(`User authenticated: ${account.username ?? 'unknown'}`)
    return h.redirect('/')
  } catch (error) {
    logger.error('Azure AD callback error:', error)

    // Restore anonymous session if it existed - this prevents review history loss
    if (restoreAnonymousSession(request, existingSession)) {
      logger.info('Restoring anonymous session after failed auth attempt')
    }

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
function logoutHandler(request, h) {
  // Microsoft just redirected back after completing sign-out
  if (request.query?.confirmed === 'true') {
    return h.view('auth/logged-out')
  }

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
