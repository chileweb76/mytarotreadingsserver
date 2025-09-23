const { ensureDatabase } = require('../utils/connectToDatabase')
const { allowedOrigins, allowedHostnames } = require('../utils/corsConfig')

async function handler(req, res) {
  await ensureDatabase()

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    const origin = req.headers.origin
    let allowOrigin = null

    if (origin) {
      // Check exact origin match
      if (allowedOrigins.includes(origin)) {
        allowOrigin = origin
      } else {
        // Check hostname match
        try {
          const reqHostname = new URL(origin).hostname.replace(/^www\./i, '').toLowerCase()
          if (allowedHostnames.includes(reqHostname)) {
            allowOrigin = origin
          }
        } catch (e) {
          // Invalid origin URL, skip
        }
      }

      // Fallback: accept .vercel.app domains
      if (!allowOrigin && origin.includes('.vercel.app')) {
        allowOrigin = origin
      }
    }

    // Also check request host as fallback
    if (!allowOrigin) {
      const host = req.headers.host
      if (host && (allowedHostnames.includes(host) || host.includes('.vercel.app'))) {
        allowOrigin = req.headers['x-forwarded-proto'] ? 
          `${req.headers['x-forwarded-proto']}://${host}` : 
          `https://${host}`
      }
    }

    if (allowOrigin) {
      res.setHeader('Access-Control-Allow-Origin', allowOrigin)
      res.setHeader('Vary', 'Origin')
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-user-id, X-Requested-With, Accept, Origin')
      res.setHeader('Access-Control-Allow-Credentials', 'true')
    }

    return res.status(200).end()
  }

  // Forward all non-OPTIONS requests to the Express app
  const app = require('../index')
  return app(req, res)
}

module.exports = handler