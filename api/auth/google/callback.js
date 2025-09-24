// Specific serverless function for Google OAuth callback
// This ensures Vercel routes /api/auth/google/callback correctly

async function handler(req, res) {
  try {
    console.log('Google OAuth callback handler called with method:', req.method)
    console.log('URL:', req.url)
    console.log('Query params:', req.query)

    // For GET requests (OAuth callback), ensure the path is correct for Express
    if (req.method === 'GET') {
      // Set the correct path for Express routing
      req.url = '/api/auth/google/callback'
      
      // Load Express app lazily and forward the callback
      const app = require('../../../index')
      return app(req, res)
    }

    // Handle any other methods
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })

  } catch (error) {
    console.error('Google OAuth callback handler error:', error)
    return res.status(500).json({ error: 'Internal server error', details: error.message })
  }
}

module.exports = handler