import { msalClient } from '../../config/azure-auth.js'
import { config } from '../../config/config.js'
import { createLogger } from '../common/helpers/logging/logger.js'

const logger = createLogger()

// ── Route handlers ────────────────────────────────────────────────────────────

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
      return h.redirect('/auth/login-page')
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
    return h.redirect('/error')
  }
}

/**
 * GET /auth/callback
 * Azure AD redirects here with ?code=… after the user authenticates.
 * Exchanges the code for tokens, then stores the user in the session cookie.
 */
async function callbackHandler(request, h) {
  try {
    if (!msalClient) {
      logger.error('MSAL client not initialised – cannot process callback')
      return h.redirect('/error')
    }
    const code = request.query?.code
    if (!code) {
      logger.error('No authorization code received on /auth/callback')
      return h.redirect('/error')
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
    logger.info(`User authenticated: ${account.username ?? 'unknown'}`)
    return h.redirect('/')
  } catch (error) {
    logger.error('Azure AD callback error:', error)
    return h.redirect('/error')
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
