const { allowedOrigins, allowedHostnames } = require('../../utils/corsConfig');

/**
 * Serverless function to handle CORS preflight and requests for /api/readings/:id
 */
module.exports = async (req, res) => {
  try {
    const origin = req.headers.origin;
    const requestHost = req.headers.host;
    
    console.log('Readings [id] handler - Method:', req.method, 'URL:', req.url, 'Origin:', origin); // Debug log
    console.log('Allowed origins:', allowedOrigins); // Debug log
    
    // Always set comprehensive CORS headers
    res.setHeader('Access-Control-Allow-Origin', origin && allowedOrigins.includes(origin) ? origin : '*');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-user-id, X-Requested-With, Accept, Origin, x-vercel-blob-store');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Length,X-Request-Id');
    res.setHeader('Vary', 'Origin');

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      console.log('Readings [id] handler: Handling OPTIONS preflight')
      return res.status(200).end();
    }
    
    console.log('Readings [id] handler: Forwarding to Express')
    const app = require('../../index.js');
    return app(req, res);
    
  } catch (error) {
    console.error('Readings [id] handler error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};