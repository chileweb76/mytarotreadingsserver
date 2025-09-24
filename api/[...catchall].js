const { allowedOrigins, allowedHostnames } = require('../utils/corsConfig');

/**
 * Universal CORS handler for any route that doesn't match specific serverless functions
 * This should catch any remaining routes and provide CORS headers
 */
module.exports = async (req, res) => {
  try {
    const origin = req.headers.origin;
    const requestHost = req.headers.host;
    
    console.log('Universal catch-all handling:', req.method, req.url, 'Origin:', origin);
    
    // Always set CORS headers first
    const isAllowedOrigin = allowedOrigins.includes('*') || allowedOrigins.includes(origin);
    const isAllowedHost = allowedHostnames.includes('*') || allowedHostnames.includes(requestHost);
    
    if (isAllowedOrigin || isAllowedHost) {
      res.setHeader('Access-Control-Allow-Origin', origin || '*');
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-user-id, X-Requested-With, Accept, Origin');
      res.setHeader('Access-Control-Expose-Headers', 'Content-Length,X-Request-Id');
      res.setHeader('Vary', 'Origin');
    }

    // Handle preflight requests immediately
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }
    
    // Forward everything to Express app which has comprehensive routing
    const app = require('../index.js');
    return app(req, res);
    
  } catch (error) {
    console.error('Universal catch-all error:', error);
    
    // Even on error, provide CORS headers
    if (req.headers.origin) {
      res.setHeader('Access-Control-Allow-Origin', req.headers.origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Vary', 'Origin');
    }
    
    return res.status(500).json({ 
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
    });
  }
};