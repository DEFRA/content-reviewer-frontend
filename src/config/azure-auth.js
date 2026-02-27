import { ConfidentialClientApplication } from '@azure/msal-node'
import { config } from './config.js'
import { createLogger } from '../server/common/helpers/logging/logger.js'

const logger = createLogger()

const clientId = config.get('azure.clientId')
const clientSecret = config.get('azure.clientSecret')
const tenantId = config.get('azure.tenantId')

if (!clientId || !tenantId) {
  logger.warn(
    'Azure AD SSO configuration missing: AZURE_CLIENT_ID and AZURE_TENANT_ID must be set'
  )
}

if (!clientSecret) {
  logger.warn(
    'Azure AD SSO configuration missing: AZURE_CLIENT_SECRET must be set'
  )
}

export const msalConfig = {
  auth: {
    clientId: clientId || '',
    authority: `https://login.microsoftonline.com/${tenantId || 'common'}`,
    clientSecret: clientSecret || ''
  },
  system: {
    loggerOptions: {
      loggerCallback: (level, message) => {
        logger.debug(`MSAL [${level}]: ${message}`)
      },
      piiLoggingEnabled: false,
      logLevel: 'Warning'
    }
  }
}

export const msalClient =
  clientId && clientSecret && tenantId
    ? new ConfidentialClientApplication(msalConfig)
    : null
