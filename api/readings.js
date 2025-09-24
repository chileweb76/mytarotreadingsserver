const { connectToDatabase } = require('../utils/connectToDatabase')
const { allowedOrigins, allowedHostnames } = require('../utils/corsConfig')

async function handler(req, res) {
  await connectToDatabase()

  // Always set CORS headers for all requests
  const origin = req.headers.origin
  console.log('Readings.js handler - Method:', req.method, 'Origin:', origin, 'Setting CORS headers');
  
  res.setHeader('Access-Control-Allow-Origin', origin || '*')
  res.setHeader('Vary', 'Origin')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-user-id, X-Requested-With, Accept, Origin, x-vercel-blob-store')
  res.setHeader('Access-Control-Allow-Credentials', 'true')
  res.setHeader('Access-Control-Expose-Headers', 'Content-Length,X-Request-Id')

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  // Forward all non-OPTIONS requests to the Express app
  const app = require('../index')
  return app(req, res)
}

module.exports = handler