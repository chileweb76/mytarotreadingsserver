const { allowedOrigins, allowedHostnames } = require('../utils/corsConfig');

/**
 * Unified serverless function to handle CORS preflight for all dynamic routes
 * Handles: /api/decks/:id, /api/readings/:id, /api/querents/:id, /api/tags/:id, /api/spreads/:id
 * Uses Vercel's [...params] catch-all routing
 */
module.exports = async (req, res) => {
  try {
    const origin = req.headers.origin;
    const requestHost = req.headers.host;
    
    // Always set CORS headers first, regardless of the request
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
    
    // Parse the route from req.url to determine the model and ID
    const url = req.url || '';
    console.log('Catch-all handling URL:', url) // Debug log
    console.log('Full req object keys:', Object.keys(req)) // Debug log
    console.log('req.query:', req.query) // Debug log
    
    // Match /api/model/id or /model/id patterns
    const pathMatch = url.match(/^(?:\/api)?\/([^\/]+)\/([^\/]+)(?:\/.*)?$/);
    console.log('Regex match result:', pathMatch) // Debug log
    
    if (!pathMatch) {
      // If it doesn't match a dynamic route pattern, forward to Express
      console.log('No match, forwarding to Express')
      const app = require('../index.js');
      return app(req, res);
    }
    
    const [, model, id] = pathMatch;
    const validModels = ['decks', 'readings', 'querents', 'tags', 'spreads'];
    
    console.log('Parsed model:', model, 'id:', id) // Debug log
    
    // Only handle dynamic routes for our specific models
    if (!validModels.includes(model)) {
      console.log('Invalid model, forwarding to Express')
      const app = require('../index.js');
      return app(req, res);
    }
    
    // For non-OPTIONS requests, forward to the main Express app
    console.log('Valid model, forwarding to Express')
    const app = require('../index.js');
    return app(req, res);
    
  } catch (error) {
    console.error('Dynamic routes serverless error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
    });
  }
};