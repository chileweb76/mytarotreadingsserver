const { connectToDatabase } = require('../utils/connectToDatabase')
const { allowedOrigins, allowedHostnames } = require('../utils/corsConfig')

async function handler(req, res) {
  await connectToDatabase()

  // Always set CORS headers for all requests
  const origin = req.headers.origin
  console.log('Readings.js handler - Method:', req.method, 'URL:', req.url, 'Origin:', origin);
  console.log('Allowed origins:', allowedOrigins);
  
  // Set comprehensive CORS headers - use permissive origin for debugging
  res.setHeader('Access-Control-Allow-Origin', origin || '*')
  res.setHeader('Access-Control-Allow-Credentials', 'true')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-user-id, X-Requested-With, Accept, Origin, x-vercel-blob-store')
  res.setHeader('Access-Control-Expose-Headers', 'Content-Length,X-Request-Id')
  res.setHeader('Vary', 'Origin')

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    console.log('Readings.js handler: Handling OPTIONS preflight')
    return res.status(200).end()
  }

  console.log('Readings.js handler: Forwarding to Express app')
  
  // Forward all non-OPTIONS requests to the Express app
  const app = require('../index')
  return app(req, res)
}

module.exports = handler