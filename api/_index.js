/**
 * Vercel serverless function for the root index.js
 * This handles requests to the server root and ensures CORS headers
 */
module.exports = async (req, res) => {
  try {
    const origin = req.headers.origin;
    
    console.log('Root index.js handler - Method:', req.method, 'URL:', req.url, 'Origin:', origin, 'Full path:', req.path);
    
    // Always set CORS headers for all requests
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-user-id, X-Requested-With, Accept, Origin');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Length,X-Request-Id');
    res.setHeader('Vary', 'Origin');

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      console.log('Root index.js: Preflight request handled');
      return res.status(200).end();
    }

    // If this is a request to the root, provide API information
    if (req.url === '/' || !req.url) {
      return res.status(200).json({
        message: 'Tarot Readings Server',
        status: 'running',
        apiBase: '/api',
        endpoints: {
          readings: '/api/readings',
          upload: '/api/upload',
          auth: '/api/auth'
        },
        timestamp: new Date().toISOString()
      });
    }
    
    // For other requests that don't start with /api, redirect to API
    if (!req.url.startsWith('/api')) {
      console.log('Root index.js: Redirecting non-API request to /api' + req.url);
      const app = require('./index.js');  // This is the Express app
      return app(req, res);
    }

    // This shouldn't happen, but just in case
    console.log('Root index.js: Unexpected request, forwarding to Express');
    const app = require('./index.js');
    return app(req, res);
    
  } catch (error) {
    console.error('Root index.js error:', error);
    
    // Always set CORS headers even on error
    const origin = req.headers.origin;
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Vary', 'Origin');
    
    return res.status(500).json({ 
      error: 'Server error',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
};