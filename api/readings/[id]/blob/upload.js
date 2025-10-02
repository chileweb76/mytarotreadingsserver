const { connectToDatabase } = require('../../../../utils/connectToDatabase')

// Try to load centralized cors config, fall back to permissive defaults
let allowedOrigins = ['http://localhost:3000']
try {
  const corsConfig = require('../../../../utils/corsConfig')
  allowedOrigins = corsConfig.allowedOrigins || allowedOrigins
} catch (e) {
  try { console.error('api/readings/[id]/blob/upload failed to load corsConfig, using fallback', e && e.message) } catch (e2) {}
}

function setCorsHeaders(req, res) {
  const origin = req.headers.origin
  console.log('🔵 [Blob Upload CORS] Origin:', origin, 'Method:', req.method)
  
  try {
    // Always allow the frontend origin
    const allowedOrigin = origin && (
      origin.includes('mytarotreadings.vercel.app') || 
      origin.includes('localhost') ||
      allowedOrigins.includes(origin)
    ) ? origin : '*'
    
    res.setHeader('Access-Control-Allow-Origin', allowedOrigin)
    res.setHeader('Access-Control-Allow-Credentials', 'true')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-user-id, X-Requested-With, Accept, Origin, x-vercel-blob-store')
    res.setHeader('Access-Control-Expose-Headers', 'Content-Length, X-Request-Id')
    res.setHeader('Vary', 'Origin')
    // Prevent caching of CORS responses
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate')
    res.setHeader('Pragma', 'no-cache')
    res.setHeader('Expires', '0')
    
    console.log('🟢 [Blob Upload CORS] Headers set:', {
      'Access-Control-Allow-Origin': allowedOrigin,
      'Access-Control-Allow-Credentials': 'true'
    })
  } catch (e) {
    console.error('🔴 [Blob Upload CORS] Header error:', e)
  }
}

module.exports = async (req, res) => {
  setCorsHeaders(req, res)

  if (req.method === 'OPTIONS') {
    console.log('🔵 [Blob Upload] Handling OPTIONS preflight')
    return res.status(200).end()
  }

  try {
    console.log('🔵 [Blob Upload] Processing request for reading ID:', req.query.id)
    
    // Ensure DB is ready
    await connectToDatabase()
    
    // Set the reading ID in params for the Express app
    req.params = { id: req.query.id }
    req.url = `/api/readings/${req.query.id}/blob/upload`
    
    // Forward to main Express app
    const app = require('../../../index')
    return app(req, res)
  } catch (err) {
    console.error('🔴 [Blob Upload] Error:', err)
    setCorsHeaders(req, res) // Ensure CORS headers are set on error
    return res.status(500).json({ error: 'Internal server error', details: err.message })
  }
}