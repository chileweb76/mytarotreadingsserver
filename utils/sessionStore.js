// Helper to create a session store if an external store is available (Redis/Upstash or Mongo)
// This file intentionally uses deferred requires so that missing optional
// dependencies don't crash the app during module load in serverless runtimes.
module.exports = {
  async createSessionStore(options = {}) {
    const { sessionOptions } = options
    // Try Upstash/Redis first (recommended for serverless)
    const redisUrl = process.env.REDIS_URL || process.env.REDIS_TLS_URL || process.env.UPSTASH_REDIS_REST_URL
    if (redisUrl) {
      try {
        // Use ioredis if available (supports TLS auto-detection)
        const IORedis = require('ioredis')
        const RedisStoreFactory = require('connect-redis')
        const Redis = IORedis.default || IORedis
        const redisClient = new Redis(redisUrl, { tls: redisUrl.startsWith('rediss://') || redisUrl.startsWith('https://') })
        const RedisStore = RedisStoreFactory(sessionOptions && sessionOptions._sessionModule ? sessionOptions._sessionModule : require('express-session'))
        const store = new RedisStore({ client: redisClient })
        console.log('sessionStore: configured Redis store via ioredis')
        return { store, client: redisClient }
      } catch (e) {
        console.warn('sessionStore: failed to configure Redis store (ioredis/connect-redis missing or error):', e && e.message)
      }
      try {
        // Try node-redis v4 (if available)
        const { createClient } = require('redis')
        const RedisStoreFactory = require('connect-redis')
        const client = createClient({ url: redisUrl })
        client.on('error', (err) => console.warn('redis client error', err))
        await client.connect()
        const RedisStore = RedisStoreFactory(sessionOptions && sessionOptions._sessionModule ? sessionOptions._sessionModule : require('express-session'))
        const store = new RedisStore({ client })
        console.log('sessionStore: configured Redis store via node-redis')
        return { store, client }
      } catch (e) {
        console.warn('sessionStore: failed to configure Redis store (redis/connect-redis missing or error):', e && e.message)
      }
    }

    // Fall back to connect-mongo if available and MONGODB_URI is provided
    if (process.env.MONGODB_URI) {
      try {
        const MongoStore = require('connect-mongo')
        // For connect-mongo we can provide either clientPromise or mongoUrl
        const store = MongoStore.create({ mongoUrl: process.env.MONGODB_URI })
        console.log('sessionStore: configured MongoDB session store via connect-mongo')
        return { store }
      } catch (e) {
        console.warn('sessionStore: connect-mongo not available or failed:', e && e.message)
      }
    }

    // No external store available
    return { store: null }
  }
}
