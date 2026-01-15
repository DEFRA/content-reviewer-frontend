import { Engine as CatboxRedis } from '@hapi/catbox-redis'
import { Engine as CatboxMemory } from '@hapi/catbox-memory'

import { createLogger } from '../logging/logger.js'
import { buildRedisClient } from '../redis-client.js'
import { config } from '../../../../config/config.js'

export function getCacheEngine(engine) {
  const logger = createLogger()

  if (engine === 'redis') {
    try {
      logger.info('Using Redis session cache')
      const redisClient = buildRedisClient(config.get('redis'))
      return new CatboxRedis({ client: redisClient })
    } catch (error) {
      logger.error(
        'Failed to connect to Redis, falling back to memory cache:',
        error.message
      )
      logger.info('Using Catbox Memory session cache (fallback)')
      return new CatboxMemory()
    }
  }

  if (config.get('isProduction')) {
    logger.error(
      'Catbox Memory is for local development only, it should not be used in production!'
    )
  }

  logger.info('Using Catbox Memory session cache')
  return new CatboxMemory()
}
