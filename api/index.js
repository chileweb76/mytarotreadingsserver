const { allowedOrigins, allowedHostnames } = require('../utils/corsConfig');

/**
 * Final catch-all for any API routes that don't match other patterns
 * Provides CORS headers and forwards to Express app
 */
module.exports = async (req, res) => {
  try {
    const origin = req.headers.origin;
    const requestHost = req.headers.host;
    
    console.log('API catch-all handling:', req.method, req.url, 'Origin:', origin); // Debug log
    
    // Always set CORS headers for all requests
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-user-id, X-Requested-With, Accept, Origin');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Length,X-Request-Id');
    res.setHeader('Vary', 'Origin');

    // Handle preflight requests immediately
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }
    
    // Forward all other requests to Express app
    console.log('API catch-all: Forwarding to Express')
    const app = require('../index.js');
    return app(req, res);
    
  } catch (error) {
    console.error('API catch-all error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};