const { allowedOrigins, allowedHostnames } = require('../../utils/corsConfig');

/**
 * Specific handler for /api/decks/[id] route
 */
module.exports = async (req, res) => {
  try {
    const origin = req.headers.origin;
    const requestHost = req.headers.host;
    
    console.log('Decks [id] handler - URL:', req.url) // Debug log
    console.log('Decks [id] handler - query:', req.query) // Debug log
    
    // Set CORS headers
    const isAllowedOrigin = allowedOrigins.includes('*') || allowedOrigins.includes(origin);
    const isAllowedHost = allowedHostnames.includes('*') || allowedHostnames.includes(requestHost);
    
    if (isAllowedOrigin || isAllowedHost) {
      res.setHeader('Access-Control-Allow-Origin', origin || '*');
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-user-id');
      res.setHeader('Access-Control-Expose-Headers', 'Content-Length,X-Request-Id');
    }

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }
    
    console.log('Decks [id] handler: Forwarding to Express')
    const app = require('../../index.js');
    return app(req, res);
    
  } catch (error) {
    console.error('Decks [id] handler error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};