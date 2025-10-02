/**
 * Simple CORS test endpoint to debug browser vs curl differences
 */
module.exports = async (req, res) => {
  // Set comprehensive CORS headers immediately
  const origin = req.headers.origin || 'https://mytarotreadings.vercel.app'
  
  try {
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Access-Control-Allow-Credentials', 'true')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-user-id, X-Requested-With, Accept, Origin, x-vercel-blob-store, x-reading-id, User-Agent, Cache-Control, Pragma')
    res.setHeader('Access-Control-Expose-Headers', 'Content-Length, X-Request-Id')
    res.setHeader('Vary', 'Origin')
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0')
    res.setHeader('Pragma', 'no-cache')
    res.setHeader('Expires', '0')
    
    console.log('🔵 [CORS Test] Method:', req.method, 'Origin:', origin)
    console.log('🔵 [CORS Test] Headers:', JSON.stringify(req.headers, null, 2))
    
    if (req.method === 'OPTIONS') {
      console.log('🟢 [CORS Test] Handling OPTIONS preflight')
      return res.status(200).json({ 
        message: 'CORS preflight successful',
        method: req.method,
        origin: origin,
        timestamp: new Date().toISOString()
      })
    }
    
    return res.status(200).json({
      message: 'CORS test endpoint working',
      method: req.method,
      origin: origin,
      timestamp: new Date().toISOString(),
      readingId: req.query.readingId || 'none'
    })
  } catch (error) {
    console.error('🔴 [CORS Test] Error:', error)
    return res.status(500).json({ error: error.message })
  }
}