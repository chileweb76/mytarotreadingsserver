const { allowedOrigins, allowedHostnames } = require('../../utils/corsConfig');

/**
 * Specific handler for /api/tags/[id] route
 */
module.exports = async (req, res) => {
  try {
    const origin = req.headers.origin;
    const requestHost = req.headers.host;
    
    console.log('Tags [id] handler - URL:', req.url) // Debug log
    console.log('Tags [id] handler - query:', req.query) // Debug log
    
    // Always set CORS headers for all requests
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-user-id, X-Requested-With, Accept, Origin');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Length,X-Request-Id');
    res.setHeader('Vary', 'Origin');

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }
    
    console.log('Tags [id] handler: Forwarding to Express')
    const app = require('../../index.js');
    return app(req, res);
    
  } catch (error) {
    console.error('Tags [id] handler error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};