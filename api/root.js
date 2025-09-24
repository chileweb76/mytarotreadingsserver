/**
 * Root serverless function handler - catches requests to the server root
 * Always provides CORS headers to prevent CORS failures
 */
module.exports = async (req, res) => {
  try {
    const origin = req.headers.origin;
    const method = req.method;
    const url = req.url;
    
    console.log('Root handler - Method:', method, 'URL:', url, 'Origin:', origin);
    
    // Always set comprehensive CORS headers
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-user-id, X-Requested-With, Accept, Origin');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Length,X-Request-Id');
    res.setHeader('Vary', 'Origin');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

    // Handle preflight requests immediately
    if (req.method === 'OPTIONS') {
      console.log('Root handler: Preflight request handled');
      return res.status(200).end();
    }

    // For GET requests to root, return API info
    if (req.method === 'GET' && (req.url === '/' || !req.url || req.url === '')) {
      return res.status(200).json({
        message: 'Tarot Readings Server API',
        version: '1.0.0',
        status: 'running',
        endpoints: {
          api: '/api',
          readings: '/api/readings',
          upload: '/api/upload',
          debug: '/api/debug-cors'
        },
        timestamp: new Date().toISOString()
      });
    }

    // For other requests, forward to Express app
    console.log('Root handler: Forwarding to Express app');
    const app = require('./index.js');
    return app(req, res);
    
  } catch (error) {
    console.error('Root handler error:', error);
    
    // Even on error, set CORS headers
    const origin = req.headers.origin;
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Vary', 'Origin');
    
    return res.status(500).json({ 
      error: 'Internal server error', 
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
};