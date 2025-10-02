/**
 * Alternative blob upload endpoint with completely different naming to bypass any caching
 */
const { connectToDatabase } = require('../utils/connectToDatabase')

module.exports = async (req, res) => {
  // Set aggressive CORS headers immediately - no middleware dependencies
  const origin = req.headers.origin
  
  // Set headers synchronously to avoid any timing issues
  res.setHeader('Access-Control-Allow-Origin', origin || 'https://mytarotreadings.vercel.app')
  res.setHeader('Access-Control-Allow-Credentials', 'true')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-user-id, X-Requested-With, Accept, Origin, x-vercel-blob-store, x-reading-id, User-Agent, Cache-Control, Pragma')
  res.setHeader('Access-Control-Expose-Headers', 'Content-Length, X-Request-Id')
  res.setHeader('Vary', 'Origin')
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0')
  res.setHeader('Pragma', 'no-cache')
  res.setHeader('Expires', '0')
  res.setHeader('Last-Modified', new Date().toUTCString())
  
  console.log('🔵 [Upload Alternative] Method:', req.method, 'Origin:', origin, 'URL:', req.url)
  console.log('🔵 [Upload Alternative] Headers:', JSON.stringify({
    origin: req.headers.origin,
    'user-agent': req.headers['user-agent']?.substring(0, 50),
    'access-control-request-method': req.headers['access-control-request-method'],
    'access-control-request-headers': req.headers['access-control-request-headers']
  }, null, 2))
  
  if (req.method === 'OPTIONS') {
    console.log('🟢 [Upload Alternative] OPTIONS handled successfully')
    return res.status(200).json({ 
      success: true, 
      message: 'CORS preflight OK for alternative upload endpoint',
      timestamp: new Date().toISOString()
    })
  }
  
  try {
    const readingId = req.query.readingId || req.headers['x-reading-id']
    console.log('🔵 [Upload Alternative] Processing upload for reading:', readingId)
    
    if (!readingId) {
      return res.status(400).json({ error: 'Reading ID required' })
    }
    
    await connectToDatabase()
    
    // Forward to Express app
    req.params = { id: readingId }
    req.url = `/api/readings/${readingId}/blob/upload`
    
    const app = require('../index')
    return app(req, res)
    
  } catch (error) {
    console.error('🔴 [Upload Alternative] Error:', error)
    // Ensure CORS headers are set on error
    res.setHeader('Access-Control-Allow-Origin', origin || 'https://mytarotreadings.vercel.app')
    res.setHeader('Access-Control-Allow-Credentials', 'true')
    return res.status(500).json({ error: 'Server error', details: error.message })
  }
}