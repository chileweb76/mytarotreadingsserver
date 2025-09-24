/**
 * Serverless function to handle blob upload for specific reading
 * Handles: POST /api/readings/[id]/blob/upload
 */
module.exports = async (req, res) => {
  try {
    const origin = req.headers.origin;
    
    console.log('Reading blob upload handler - Method:', req.method, 'URL:', req.url, 'Origin:', origin);
    
    // Always set CORS headers for all requests
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-user-id, X-Requested-With, Accept, Origin, x-vercel-blob-store');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Length,X-Request-Id');
    res.setHeader('Vary', 'Origin');

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      console.log('Reading blob upload: Preflight request handled');
      return res.status(200).end();
    }
    
    console.log('Reading blob upload: Forwarding to Express app');
    const app = require('../../../../index.js');
    return app(req, res);
    
  } catch (error) {
    console.error('Reading blob upload handler error:', error);
    
    // Always set CORS headers even on error
    const origin = req.headers.origin;
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Vary', 'Origin');
    
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
};