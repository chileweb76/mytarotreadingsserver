async function handler(req, res) {
  try {
    // Handle CORS preflight without database connection
    if (req.method === 'OPTIONS') {
      const origin = req.headers.origin
      
      // Simple CORS check for our known origins
      if (origin && (
        origin === 'https://mytarotreadings.vercel.app' ||
        origin.includes('mytarotreadings') ||
        origin.includes('.vercel.app')
      )) {
        res.setHeader('Access-Control-Allow-Origin', origin)
        res.setHeader('Vary', 'Origin')
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-user-id, X-Requested-With, Accept, Origin')
        res.setHeader('Access-Control-Allow-Credentials', 'true')
      }

      return res.status(200).end()
    }

    // For non-OPTIONS requests, ensure database and load Express app
    const { ensureDatabase } = require('../../utils/connectToDatabase')
    await ensureDatabase()
    
    const app = require('../../index')
    return app(req, res)
  } catch (error) {
    console.error('Insights/count handler error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}

module.exports = handler