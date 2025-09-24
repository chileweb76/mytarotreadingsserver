/**
 * Simple API root handler that always returns CORS headers
 * Handles requests to /api that don't match other patterns
 */
module.exports = async (req, res) => {
  try {
    const origin = req.headers.origin;
    
    console.log('API root handler - Method:', req.method, 'URL:', req.url, 'Origin:', origin);
    
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

    // For GET requests to the API root, return basic info
    if (req.method === 'GET') {
      return res.status(200).json({ 
        message: 'Tarot Readings API',
        version: '1.0.0',
        endpoints: ['/readings', '/decks', '/spreads', '/querents', '/tags', '/upload']
      });
    }
    
    // For other methods, forward to Express app
    console.log('API root: Forwarding to Express app');
    const app = require('../index.js');
    return app(req, res);
    
  } catch (error) {
    console.error('API root handler error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};