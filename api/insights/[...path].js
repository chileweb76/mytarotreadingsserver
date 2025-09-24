async function handler(req, res) {
  try {
    console.log('Insights [...path] handler called with method:', req.method)
    console.log('URL:', req.url)
    console.log('Origin:', req.headers.origin)

    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
      const origin = req.headers.origin
      
      // Simple CORS response
      if (origin && origin.includes('mytarotreadings.vercel.app')) {
        res.setHeader('Access-Control-Allow-Origin', origin)
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-user-id, X-Requested-With, Accept, Origin')
        res.setHeader('Access-Control-Allow-Credentials', 'true')
      }

      return res.status(200).end()
    }

    // For non-OPTIONS requests, load Express app lazily
    const app = require('../../index')
    return app(req, res)

  } catch (error) {
    console.error('Insights [...path] handler error:', error)
    return res.status(500).json({ error: 'Internal server error', details: error.message })
  }
}

module.exports = handler