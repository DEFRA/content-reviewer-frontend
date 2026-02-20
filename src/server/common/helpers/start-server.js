import { createServer } from '../../server.js'
import { config } from '../../../config/config.js'

const SEPARATOR_LINE = '========================================='
const NOT_SET_VALUE = 'NOT SET'

async function startServer () {
  const server = await createServer()
  await server.start()

  server.logger.info('Server started successfully', {
    port: config.get('port'),
    environment: process.env.ENVIRONMENT || 'local'
  })
  server.logger.info(
    `Access your frontend on http://localhost:${config.get('port')}`,
    { port: config.get('port') }
  )

  // Log critical configuration for debugging CDP deployment
  console.log('\nCONFIGURATION DEBUG - CRITICAL SETTINGS:')
  console.log(SEPARATOR_LINE)
  console.log('Environment:', process.env.ENVIRONMENT || 'local')
  console.log('Node Environment:', process.env.NODE_ENV)
  console.log('Port:', config.get('port'))
  console.log('Backend URL:', config.get('backendUrl'))

  console.log('\nCDP UPLOADER CONFIG:')
  console.log('- Uploader URL:', config.get('cdpUploader.url'))
  console.log('- S3 Bucket:', config.get('cdpUploader.s3Bucket'))
  console.log('- S3 Path:', config.get('cdpUploader.s3Path'))
  console.log('- Max File Size:', config.get('cdpUploader.maxFileSize'))
  console.log(
    '- Allowed MIME Types:',
    config.get('cdpUploader.allowedMimeTypes')
  )

  console.log('\nSESSION CONFIG:')
  console.log('- Cache Engine:', config.get('session.cache.engine'))
  console.log('- Cookie Secure:', config.get('session.cookie.secure'))

  console.log('\nREDIS CONFIG (if applicable):')
  console.log('- Host:', config.get('redis.host'))
  console.log('- Use TLS:', config.get('redis.useTLS'))
  console.log('- Single Instance:', config.get('redis.useSingleInstanceCache'))

  console.log('\nLOGGING CONFIG:')
  console.log('- Log Level:', config.get('log.level'))
  console.log('- Log Format:', config.get('log.format'))
  console.log('- Log Enabled:', config.get('log.enabled'))
  console.log(SEPARATOR_LINE + '\n')

  // Log environment variables for CDP debugging
  console.log('\nENVIRONMENT VARIABLES RELEVANT TO CDP:')
  console.log(SEPARATOR_LINE)
  console.log('NODE_ENV:', process.env.NODE_ENV || NOT_SET_VALUE)
  console.log('ENVIRONMENT:', process.env.ENVIRONMENT || NOT_SET_VALUE)
  console.log('PORT:', config.get('port'))
  console.log('BACKEND_URL:', config.get('backendUrl'))
  console.log('CDP_UPLOADER_URL:', config.get('cdpUploader.url'))
  console.log('CDP_UPLOADER_S3_BUCKET:', config.get('cdpUploader.s3Bucket'))
  console.log('CDP_UPLOADER_S3_PATH:', config.get('cdpUploader.s3Path'))
  console.log('SESSION_CACHE_ENGINE:', config.get('session.cache.engine'))
  console.log('REDIS_HOST:', config.get('redis.host'))
  console.log('REDIS_TLS:', config.get('redis.useTLS'))
  console.log(SEPARATOR_LINE + '\n')

  return server
}

export { startServer }
