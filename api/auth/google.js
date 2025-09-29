// Google OAuth initiation handler
module.exports = async (req, res) => {
  try {
    console.log('Google OAuth handler called')
    
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
    
    // For Google OAuth initiation, redirect to the proper OAuth URL
    if (req.method === 'GET') {
      // Construct the Google OAuth URL
      const clientId = process.env.GOOGLE_CLIENT_ID
      const serverUrl = process.env.SERVER_URL || process.env.API_BASE_URL || 'https://mytarotreadingsserver.vercel.app'
      const redirectUri = `${serverUrl}/api/auth/google/callback`
      
      const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
        `client_id=${encodeURIComponent(clientId)}&` +
        `redirect_uri=${encodeURIComponent(redirectUri)}&` +
        `response_type=code&` +
        `scope=${encodeURIComponent('profile email')}&` +
        `access_type=offline&` +
        `prompt=consent`
      
      console.log('Redirecting to Google OAuth URL:', googleAuthUrl)
      return res.redirect(googleAuthUrl)
    }
    
    // Otherwise forward to Express app
    const app = require('../../index')
    return app(req, res)
    
  } catch (error) {
    console.error('Google OAuth handler error:', error)
    return res.status(500).json({ error: 'OAuth initialization failed' })
  }
}