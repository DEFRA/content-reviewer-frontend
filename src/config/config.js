import convict from 'convict'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import convictFormatWithValidator from 'convict-format-with-validator'

const dirname = path.dirname(fileURLToPath(import.meta.url))

const tenHoursMs = 36000000 // GDS standard: one working day
const oneWeekMs = 604800000

const isProduction = process.env.NODE_ENV === 'production'
const isTest = process.env.NODE_ENV === 'test'
const isDevelopment = process.env.NODE_ENV === 'development'

convict.addFormats(convictFormatWithValidator)

export const config = convict({
  serviceVersion: {
    doc: 'The service version, this variable is injected into your docker container in CDP environments',
    format: String,
    nullable: true,
    default: null,
    env: 'SERVICE_VERSION'
  },
  host: {
    doc: 'The IP address to bind',
    format: 'ipaddress',
    default: '0.0.0.0',
    env: 'HOST'
  },
  port: {
    doc: 'The port to bind.',
    format: 'port',
    default: 3000,
    env: 'PORT'
  },
  staticCacheTimeout: {
    doc: 'Static cache timeout in milliseconds',
    format: Number,
    default: oneWeekMs,
    env: 'STATIC_CACHE_TIMEOUT'
  },
  serviceName: {
    doc: 'Applications Service Name',
    format: String,
    default: 'Content Review Tool'
  },
  root: {
    doc: 'Project root',
    format: String,
    default: path.resolve(dirname, '../..')
  },
  assetPath: {
    doc: 'Asset path',
    format: String,
    default: '/public',
    env: 'ASSET_PATH'
  },
  isProduction: {
    doc: 'If this application running in the production environment',
    format: Boolean,
    default: isProduction
  },
  isDevelopment: {
    doc: 'If this application running in the development environment',
    format: Boolean,
    default: isDevelopment
  },
  isTest: {
    doc: 'If this application running in the test environment',
    format: Boolean,
    default: isTest
  },
  log: {
    enabled: {
      doc: 'Is logging enabled',
      format: Boolean,
      default: !isTest,
      env: 'LOG_ENABLED'
    },
    level: {
      doc: 'Logging level',
      format: ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'],
      default: 'info',
      env: 'LOG_LEVEL'
    },
    format: {
      doc: 'Format to output logs in.',
      format: ['ecs', 'pino-pretty'],
      default:
        isDevelopment && !process.env.ENVIRONMENT ? 'pino-pretty' : 'ecs',
      env: 'LOG_FORMAT'
    },
    redact: {
      doc: 'Log paths to redact',
      format: Array,
      default: isProduction
        ? ['req.headers.authorization', 'req.headers.cookie', 'res.headers']
        : []
    }
  },
  httpProxy: {
    doc: 'HTTP Proxy',
    format: String,
    nullable: true,
    default: null,
    env: 'HTTP_PROXY'
  },
  isSecureContextEnabled: {
    doc: 'Enable Secure Context',
    format: Boolean,
    default: isProduction,
    env: 'ENABLE_SECURE_CONTEXT'
  },
  isMetricsEnabled: {
    doc: 'Enable metrics reporting',
    format: Boolean,
    default: isProduction,
    env: 'ENABLE_METRICS'
  },
  session: {
    cache: {
      engine: {
        doc: 'backend cache is written to',
        format: ['redis', 'memory'],
        default: isProduction ? 'redis' : 'memory',
        env: 'SESSION_CACHE_ENGINE'
      },
      name: {
        doc: 'server side session cache name',
        format: String,
        default: 'session',
        env: 'SESSION_CACHE_NAME'
      },
      ttl: {
        doc: 'Server-side session cache TTL in ms. GDS standard is 10 hours (one working day). Matches SESSION_COOKIE_TTL.',
        format: Number,
        default: tenHoursMs,
        env: 'SESSION_CACHE_TTL'
      }
    },
    cookie: {
      ttl: {
        doc: 'Session cookie TTL in ms. GDS standard: 10 hours (one working day). The cookie is persistent (survives browser close) – keepAlive resets the clock on every request so active users are not interrupted.',
        format: Number,
        default: tenHoursMs,
        env: 'SESSION_COOKIE_TTL'
      },
      password: {
        doc: 'session cookie password',
        format: String,
        default: 'the-password-must-be-at-least-32-characters-long',
        env: 'SESSION_COOKIE_PASSWORD',
        sensitive: true
      },
      secure: {
        doc: 'set secure flag on cookie',
        format: Boolean,
        default: isProduction,
        env: 'SESSION_COOKIE_SECURE'
      }
    }
  },
  redis: {
    host: {
      doc: 'Redis cache host',
      format: String,
      default: '127.0.0.1',
      env: 'REDIS_HOST'
    },
    username: {
      doc: 'Redis cache username',
      format: String,
      default: '',
      env: 'REDIS_USERNAME'
    },
    password: {
      doc: 'Redis cache password',
      format: '*',
      default: '',
      sensitive: true,
      env: 'REDIS_PASSWORD'
    },
    keyPrefix: {
      doc: 'Redis cache key prefix name used to isolate the cached results across multiple clients',
      format: String,
      default: 'content-reviewer-frontend:',
      env: 'REDIS_KEY_PREFIX'
    },
    useSingleInstanceCache: {
      doc: 'Connect to a single instance of redis instead of a cluster.',
      format: Boolean,
      default: !isProduction,
      env: 'USE_SINGLE_INSTANCE_CACHE'
    },
    useTLS: {
      doc: 'Connect to redis using TLS',
      format: Boolean,
      default: isProduction,
      env: 'REDIS_TLS'
    }
  },
  nunjucks: {
    watch: {
      doc: 'Reload templates when they are changed.',
      format: Boolean,
      default: isDevelopment
    },
    noCache: {
      doc: 'Use a cache and recompile templates each time',
      format: Boolean,
      default: isDevelopment
    }
  },
  tracing: {
    header: {
      doc: 'Which header to track',
      format: String,
      default: 'x-cdp-request-id',
      env: 'TRACING_HEADER'
    }
  },
  backendUrl: {
    doc: 'Backend API URL',
    format: String,
    default: 'https://content-reviewer-backend.dev.cdp-int.defra.cloud',
    env: 'BACKEND_URL'
  },
  cdpUploader: {
    url: {
      doc: 'CDP Uploader service URL',
      format: String,
      default: 'http://localhost:8085',
      env: 'CDP_UPLOADER_URL'
    },
    s3Bucket: {
      doc: 'S3 bucket for uploaded files',
      format: String,
      default: 'dev-service-optimisation-c63f2',
      env: 'AWS_S3_BUCKET_NAME'
    },
    s3Path: {
      doc: 'S3 path prefix for uploaded files',
      format: String,
      default: 'content-uploads',
      env: 'CDP_UPLOADER_S3_PATH'
    },
    maxFileSize: {
      doc: 'Maximum file size in bytes (10MB default)',
      format: Number,
      default: 10 * 1000 * 1000,
      env: 'CDP_UPLOADER_MAX_FILE_SIZE'
    },
    allowedMimeTypes: {
      doc: 'Allowed MIME types for uploads',
      format: Array,
      default: [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      ],
      env: 'CDP_UPLOADER_MIME_TYPES'
    }
  },
  contentReview: {
    maxCharLength: {
      doc: 'Maximum character length for content review textarea',
      format: Number,
      default: 50000,
      env: 'CONTENT_REVIEW_MAX_CHAR_LEN'
    }
  },
  azure: {
    clientId: {
      doc: 'Azure AD Application Client ID',
      format: String,
      default: '',
      env: 'AZURE_CLIENT_ID'
    },
    clientSecret: {
      doc: 'Azure AD Application Client Secret',
      format: String,
      sensitive: true,
      default: '',
      env: 'AZURE_CLIENT_SECRET'
    },
    tenantId: {
      doc: 'Azure AD Tenant ID',
      format: String,
      default: '',
      env: 'AZURE_TENANT_ID'
    },
    redirectUri: {
      doc: 'Application redirect URI after login (CDP: /auth/callback, local: http://localhost:3000/auth/callback)',
      format: String,
      default: 'http://localhost:3000/auth/callback',
      env: 'AZURE_REDIRECT_URI'
    },
    postLogoutRedirectUri: {
      doc: 'URI Microsoft redirects to after completing sign-out. Must match the registered Redirect URI in Azure App Registration. CDP: https://content-reviewer-frontend.dev.cdp-int.defra.cloud/auth/logout  Local: http://localhost:3000/auth/logout',
      format: String,
      default: 'http://localhost:3000/auth/logout',
      env: 'AZURE_POST_LOGOUT_REDIRECT_URI'
    }
  }
})

config.validate({ allowed: 'strict' })
