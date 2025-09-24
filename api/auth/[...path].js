async function handler(req, res) {
  try {
    console.log('Auth [...path] handler called with method:', req.method)
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

    // For non-OPTIONS requests, normalize the incoming path so the
    // Express app (which mounts auth routes under /api/auth) will match.
    // Vercel rewrites may not update req.url when proxying, so ensure the
    // path starts with /api.
    if (typeof req.url === 'string') {
      // If the path already starts with /api, leave it; else prefix with /api
      if (!req.url.startsWith('/api/')) {
        // Ensure we don't double-prefix if client sent /auth/...
        // If it starts with /auth, convert to /api/auth
        if (req.url.startsWith('/auth')) {
          req.url = '/api' + req.url
        } else {
          req.url = '/api/auth' + (req.url === '/' ? '' : req.url)
        }
      }
    }

    // For non-OPTIONS requests, load Express app lazily and forward
    const app = require('../../index')
    return app(req, res)

  } catch (error) {
    console.error('Auth [...path] handler error:', error)
    return res.status(500).json({ error: 'Internal server error', details: error.message })
  }
}

module.exports = handler