import { ecsFormat } from '@elastic/ecs-pino-format'
import { getTraceId } from '@defra/hapi-tracing'

import { config } from '../../../../config/config.js'

const logConfig = config.get('log')
const serviceName = config.get('serviceName')
const serviceVersion = config.get('serviceVersion')

// HTTP Status Code Thresholds
const HTTP_STATUS_ERROR_THRESHOLD = 500
const HTTP_STATUS_WARNING_THRESHOLD = 400
const HTTP_STATUS_REDIRECT_THRESHOLD = 300

const formatters = {
  ecs: {
    ...ecsFormat({
      serviceVersion,
      serviceName
    })
  },
  'pino-pretty': { transport: { target: 'pino-pretty' } }
}

export const loggerOptions = {
  enabled: logConfig.enabled,
  ignorePaths: ['/health'],
  redact: {
    paths: logConfig.redact,
    remove: true
  },
  level: logConfig.level,
  ...formatters[logConfig.format],
  // Set log level based on response status
  // This ensures request logs use appropriate levels instead of defaulting to 'error'
  customLogLevel: (_req, res, err) => {
    if (err || res.statusCode >= HTTP_STATUS_ERROR_THRESHOLD) {
      return 'error'
    }
    if (res.statusCode >= HTTP_STATUS_WARNING_THRESHOLD) {
      return 'warn'
    }
    if (res.statusCode >= HTTP_STATUS_REDIRECT_THRESHOLD) {
      return 'info'
    }
    return 'info'
  },
  nesting: true,
  mixin() {
    const mixinValues = {}
    const traceId = getTraceId()
    if (traceId) {
      mixinValues.trace = { id: traceId }
    }
    return mixinValues
  }
}
