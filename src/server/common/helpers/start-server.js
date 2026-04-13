import { createServer } from '../../server.js'
import { config } from '../../../config/config.js'

async function startServer() {
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

  server.logger.info(
    {
      environment: process.env.ENVIRONMENT || 'local',
      nodeEnv: process.env.NODE_ENV,
      port: config.get('port'),
      backendUrl: config.get('backendUrl'),
      cdpUploaderUrl: config.get('cdpUploader.url'),
      s3Bucket: config.get('cdpUploader.s3Bucket'),
      sessionCacheEngine: config.get('session.cache.engine'),
      redisHost: config.get('redis.host')
    },
    'Server configuration'
  )

  return server
}

export { startServer }
