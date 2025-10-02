const { connectToDatabase } = require('../../../utils/connectToDatabase')

// Try to load centralized cors config, fall back to permissive defaults
let allowedOrigins = ['http://localhost:3000']
try {
  const corsConfig = require('../../../utils/corsConfig')
  allowedOrigins = corsConfig.allowedOrigins || allowedOrigins
} catch (e) {
  try { console.error('api/blob-upload-v2 failed to load corsConfig, using fallback', e && e.message) } catch (e2) {}
}

function setCorsHeaders(req, res) {
  const origin = req.headers.origin
  console.log('🔵 [Blob Upload V2 CORS] Origin:', origin, 'Method:', req.method)
  
  try {
    // Always allow the frontend origin - be more permissive for debugging
    let allowedOrigin = '*'
    if (origin) {
      if (origin.includes('mytarotreadings.vercel.app') || 
          origin.includes('localhost') ||
          allowedOrigins.includes(origin)) {
        allowedOrigin = origin
      }
    }
    
    res.setHeader('Access-Control-Allow-Origin', allowedOrigin)
    res.setHeader('Access-Control-Allow-Credentials', 'true')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-user-id, X-Requested-With, Accept, Origin, x-vercel-blob-store, x-reading-id')
    res.setHeader('Access-Control-Expose-Headers', 'Content-Length, X-Request-Id')
    res.setHeader('Vary', 'Origin')
    // Aggressive cache prevention
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0')
    res.setHeader('Pragma', 'no-cache')
    res.setHeader('Expires', '0')
    res.setHeader('Last-Modified', new Date().toUTCString())
    
    console.log('🟢 [Blob Upload V2 CORS] Headers set:', {
      'Access-Control-Allow-Origin': allowedOrigin,
      'Access-Control-Allow-Credentials': 'true'
    })
  } catch (e) {
    console.error('🔴 [Blob Upload V2 CORS] Header error:', e)
  }
}

module.exports = async (req, res) => {
  setCorsHeaders(req, res)

  if (req.method === 'OPTIONS') {
    console.log('🔵 [Blob Upload V2] Handling OPTIONS preflight')
    return res.status(200).end()
  }

  try {
    // Get reading ID from query or headers
    const readingId = req.query.readingId || req.headers['x-reading-id']
    console.log('🔵 [Blob Upload V2] Processing request for reading ID:', readingId)
    
    if (!readingId) {
      return res.status(400).json({ error: 'Reading ID is required as query parameter or x-reading-id header' })
    }
    
    // Ensure DB is ready
    await connectToDatabase()
    
    // Set the reading ID in params for the Express app
    req.params = { id: readingId }
    req.url = `/api/readings/${readingId}/blob/upload`
    
    // Forward to main Express app
    const app = require('../../index')
    return app(req, res)
  } catch (err) {
    console.error('🔴 [Blob Upload V2] Error:', err)
    setCorsHeaders(req, res) // Ensure CORS headers are set on error
    return res.status(500).json({ error: 'Internal server error', details: err.message })
  }
}