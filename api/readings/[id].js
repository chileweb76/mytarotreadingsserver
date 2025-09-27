const { connectToDatabase } = require('../../../utils/connectToDatabase')

// Try to load centralized cors config, fall back to permissive defaults
let allowedOrigins = ['http://localhost:3000']
try {
  const corsConfig = require('../../../utils/corsConfig')
  allowedOrigins = corsConfig.allowedOrigins || allowedOrigins
} catch (e) {
  try { console.error('api/readings/[id] failed to load corsConfig, using fallback', e && e.message) } catch (e2) {}
}

function setCorsHeaders(req, res) {
  const origin = req.headers.origin || '*'
  try {
    res.setHeader('Access-Control-Allow-Origin', origin || '*')
    res.setHeader('Access-Control-Allow-Credentials', 'true')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-user-id, X-Requested-With, Accept, Origin, x-vercel-blob-store')
    res.setHeader('Access-Control-Expose-Headers', 'Content-Length, X-Request-Id')
    res.setHeader('Vary', 'Origin')
  } catch (e) {
    // ignore header set errors
  }
}

module.exports = async (req, res) => {
  setCorsHeaders(req, res)

  if (req.method === 'OPTIONS') {
    // respond OK for preflight
    res.status(200).end()
    return
  }

  try {
    // ensure DB is ready and forward request to main Express app
    await connectToDatabase()
    const app = require('../../../index')
    return app(req, res)
  } catch (err) {
    console.error('Error in api/readings/[id] handler:', err)
    if (req.method === 'OPTIONS') return res.status(200).end()
    return res.status(500).json({ error: 'Internal server error' })
  }
}
