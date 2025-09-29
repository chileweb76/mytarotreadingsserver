// Google OAuth callback handler
module.exports = async (req, res) => {
  try {
    console.log('Google OAuth callback handler called')
    console.log('Query params:', req.query)
    
    // Set CORS headers
    const origin = req.headers.origin
    if (origin) {
      res.setHeader('Access-Control-Allow-Origin', origin)
      res.setHeader('Access-Control-Allow-Credentials', 'true')
    }
    
    // Handle preflight
    if (req.method === 'OPTIONS') {
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
      return res.status(200).end()
    }
    
    // Forward to Express app which has the full Passport OAuth handling
    const app = require('../../../index')
    
    // Make sure the URL is properly formatted for Express
    if (!req.url.startsWith('/api/')) {
      req.url = '/api/auth/google/callback' + (req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : '')
    }
    
    return app(req, res)
    
  } catch (error) {
    console.error('Google OAuth callback error:', error)
    return res.status(500).json({ error: 'OAuth callback failed' })
  }
}