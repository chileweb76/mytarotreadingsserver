const mongoose = require('mongoose')

/**
 * Serverless-safe MongoDB connection helper.
 * Caches the connect promise on `global._mongoConnectPromise` so repeated
 * invocations reuse the same connection across lambda/edge invocations.
 * Includes simple retry/backoff and explicit timeouts for clearer errors.
 */
async function connectToDatabase() {
  const uri = process.env.MONGODB_URI
  if (!uri) throw new Error('MONGODB_URI is not set')

  if (global._mongoConnectPromise) return global._mongoConnectPromise

  const opts = {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: Number(process.env.MONGO_SERVER_SELECTION_TIMEOUT_MS) || 8000,
    connectTimeoutMS: Number(process.env.MONGO_CONNECT_TIMEOUT_MS) || 8000
  }

  const maxAttempts = Number(process.env.MONGO_CONNECT_RETRIES) || 3

  global._mongoConnectPromise = (async () => {
    let lastErr
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        console.log(`mongo: connecting attempt ${attempt}/${maxAttempts} (serverSelectionTimeoutMS=${opts.serverSelectionTimeoutMS})`)
        const conn = await mongoose.connect(uri, opts)
        console.log('mongo: connected')

        // Try to attach Vercel's database pool manager if available.
        // Require at runtime to avoid build-time errors outside Vercel.
        try {
          // eslint-disable-next-line global-require
          const { attachDatabasePool } = require('@vercel/functions')
          if (attachDatabasePool && typeof attachDatabasePool === 'function') {
            const client = mongoose.connection && mongoose.connection.client
            if (client) {
              attachDatabasePool(client)
              console.log('mongo: attached Vercel database pool')
            } else {
              console.warn('mongo: mongoose.connection.client not available to attach pool')
            }
          }
        } catch (attachErr) {
          // Not running on Vercel or package not present — continue without attach
        }

        return conn
      } catch (err) {
        lastErr = err
        console.error(`mongo: connect attempt ${attempt} failed:`, err && err.message ? err.message : err)
        if (attempt < maxAttempts) {
          const backoffMs = Math.min(2000 * Math.pow(2, attempt - 1), 10000)
          // small delay before retry
          await new Promise((resolve) => setTimeout(resolve, backoffMs))
        }
      }
    }
    // all attempts failed
    throw lastErr
  })()

  return global._mongoConnectPromise
}

module.exports = { connectToDatabase }
