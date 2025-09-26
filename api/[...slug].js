const { connectToDatabase } = require('../utils/connectToDatabase');

/**
 * Unified serverless function to handle all API routes with consistent CORS
 */
module.exports = async (req, res) => {
  const origin = req.headers.origin;
  
  // Set CORS headers first - always allow the requesting origin
  res.setHeader('Access-Control-Allow-Origin', origin || '*');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-user-id, X-Requested-With, Accept, Origin, x-vercel-blob-store');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Length, X-Request-Id');
  res.setHeader('Vary', 'Origin');

  // Handle OPTIONS preflight immediately
  if (req.method === 'OPTIONS') {
    console.log('Unified API: Handling OPTIONS preflight for', req.url);
    return res.status(200).end();
  }

  try {
    console.log('Unified API - Method:', req.method, 'URL:', req.url, 'Origin:', origin);

    // Connect to database for non-OPTIONS requests
    await connectToDatabase();

    // Route to Express app for all requests - let Express handle the routing
    const app = require('../index');
    return app(req, res);

  } catch (error) {
    console.error('Unified API error:', error);
    
    // Ensure CORS headers are set even in error cases
    try {
      res.setHeader('Access-Control-Allow-Origin', origin || '*');
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Vary', 'Origin');
    } catch (corsError) {
      console.error('Failed to set CORS headers in error handler:', corsError);
    }
    
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
};

/**
 * Unified serverless function to handle CORS preflight for all dynamic routes
 * Handles: /api/decks/:id, /api/readings/:id, /api/querents/:id, /api/tags/:id, /api/spreads/:id
 * Uses Vercel's [...params] catch-all routing
 */
module.exports = async (req, res) => {
  try {
    const origin = req.headers.origin;
    const requestHost = req.headers.host;
    
    console.log('Catch-all handler - Method:', req.method, 'URL:', req.url, 'Origin:', origin);
    console.log('Allowed origins:', allowedOrigins);
    
    // Always set comprehensive CORS headers for all requests - use permissive origin for debugging
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-user-id, X-Requested-With, Accept, Origin, x-vercel-blob-store');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Length,X-Request-Id');
    res.setHeader('Vary', 'Origin');

    // Handle preflight requests immediately
    if (req.method === 'OPTIONS') {
      console.log('Catch-all handler: Handling OPTIONS preflight for', req.url)
      return res.status(200).end();
    }
    
    // Parse the route from req.url to determine the model and ID
    const url = req.url || '';
    console.log('Catch-all parsing URL:', url);
    
    // Match /api/model/id or /model/id patterns
    const pathMatch = url.match(/^(?:\/api)?\/([^\/]+)\/([^\/]+)(?:\/.*)?$/);
    console.log('Path match result:', pathMatch);
    
    if (!pathMatch) {
      console.log('No path match - forwarding to Express app');
      const app = require('../index.js');
      return app(req, res);
    }
    
    const [, model, id] = pathMatch;
    const validModels = ['decks', 'readings', 'querents', 'tags', 'spreads'];
    
    console.log('Parsed model:', model, 'id:', id, 'valid:', validModels.includes(model));
    
    // Always forward to Express app for processing
    console.log('Forwarding to Express app for model:', model);
    const app = require('../index.js');
    return app(req, res);
    
  } catch (error) {
    console.error('Catch-all handler error:', error);
    
    // Even on error, ensure CORS headers are set for preflight
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }
    
    return res.status(500).json({ 
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
    });
  }
};