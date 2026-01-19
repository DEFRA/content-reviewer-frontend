import { createServer } from '../../server.js'
import { config } from '../../../config/config.js'

async function startServer() {
  const server = await createServer()
  await server.start()

  server.logger.info('Server started successfully')
  server.logger.info(
    `Access your frontend on http://localhost:${config.get('port')}`
  )

  // Log critical configuration for debugging CDP deployment
  console.log('\n🔧 CONFIGURATION DEBUG - CRITICAL SETTINGS:')
  console.log('=========================================')
  console.log('Environment:', process.env.ENVIRONMENT || 'local')
  console.log('Node Environment:', process.env.NODE_ENV)
  console.log('Port:', config.get('port'))
  console.log('Backend URL:', config.get('backendUrl'))

  console.log('\n🗄️  CDP UPLOADER CONFIG:')
  console.log('- Uploader URL:', config.get('cdpUploader.url'))
  console.log('- S3 Bucket:', config.get('cdpUploader.s3Bucket'))
  console.log('- S3 Path:', config.get('cdpUploader.s3Path'))
  console.log('- Max File Size:', config.get('cdpUploader.maxFileSize'))
  console.log(
    '- Allowed MIME Types:',
    config.get('cdpUploader.allowedMimeTypes')
  )

  console.log('\n🔐 SESSION CONFIG:')
  console.log('- Cache Engine:', config.get('session.cache.engine'))
  console.log('- Cookie Secure:', config.get('session.cookie.secure'))

  console.log('\n🔗 REDIS CONFIG (if applicable):')
  console.log('- Host:', config.get('redis.host'))
  console.log('- Use TLS:', config.get('redis.useTLS'))
  console.log('- Single Instance:', config.get('redis.useSingleInstanceCache'))

  console.log('\n📝 LOGGING CONFIG:')
  console.log('- Log Level:', config.get('log.level'))
  console.log('- Log Format:', config.get('log.format'))
  console.log('- Log Enabled:', config.get('log.enabled'))
  console.log('=========================================\n')

  // Log environment variables for CDP debugging
  console.log('\n🌍 ENVIRONMENT VARIABLES RELEVANT TO CDP:')
  console.log('=========================================')
  console.log('NODE_ENV:', process.env.NODE_ENV || 'NOT SET')
  console.log('ENVIRONMENT:', process.env.ENVIRONMENT || 'NOT SET')
  console.log('PORT:', process.env.PORT || 'NOT SET')
  console.log('BACKEND_URL:', process.env.BACKEND_URL || 'NOT SET')
  console.log('CDP_UPLOADER_URL:', process.env.CDP_UPLOADER_URL || 'NOT SET')
  console.log(
    'AWS_S3_BUCKET_NAME:',
    process.env.AWS_S3_BUCKET_NAME || 'NOT SET'
  )
  console.log(
    'CDP_UPLOADER_S3_PATH:',
    process.env.CDP_UPLOADER_S3_PATH || 'NOT SET'
  )
  console.log(
    'SESSION_CACHE_ENGINE:',
    process.env.SESSION_CACHE_ENGINE || 'NOT SET'
  )
  console.log('REDIS_HOST:', process.env.REDIS_HOST || 'NOT SET')
  console.log('REDIS_TLS:', process.env.REDIS_TLS || 'NOT SET')
  console.log('AWS_REGION:', process.env.AWS_REGION || 'NOT SET')
  console.log('=========================================\n')

  return server
}

export { startServer }
