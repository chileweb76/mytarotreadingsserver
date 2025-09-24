const { allowedOrigins, allowedHostnames } = require('../../utils/corsConfig');

/**
 * Catch-all for /api/api/* routes (which get called as /api/* from client)
 * Handles: /api/decks/:id, /api/spreads/:id, etc.
 */
module.exports = async (req, res) => {
  try {
    const origin = req.headers.origin;
    const requestHost = req.headers.host;
    
    // Parse the route from req.url to determine the model and ID
    const url = req.url || '';
    console.log('API catch-all handling URL:', url) // Debug log
    console.log('req.query:', req.query) // Debug log
    
    // Match /model/id patterns (no /api prefix here since it's already in the path)
    const pathMatch = url.match(/^\/([^\/]+)\/([^\/]+)(?:\/.*)?$/);
    console.log('API regex match result:', pathMatch) // Debug log
    
    if (!pathMatch) {
      // If it doesn't match a dynamic route pattern, forward to Express
      console.log('API catch-all: No match, forwarding to Express')
      const app = require('../../index.js');
      return app(req, res);
    }
    
    const [, model, id] = pathMatch;
    const validModels = ['decks', 'readings', 'querents', 'tags', 'spreads'];
    
    console.log('API catch-all parsed model:', model, 'id:', id) // Debug log
    
    if (!validModels.includes(model)) {
      console.log('API catch-all: Invalid model, forwarding to Express')
      const app = require('../../index.js');
      return app(req, res);
    }
    
    // Set CORS headers
    const isAllowedOrigin = allowedOrigins.includes('*') || allowedOrigins.includes(origin);
    const isAllowedHost = allowedHostnames.includes('*') || allowedHostnames.includes(requestHost);
    
    if (isAllowedOrigin || isAllowedHost) {
      res.setHeader('Access-Control-Allow-Origin', origin || '*');
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      res.setHeader('Access-Control-Expose-Headers', 'Content-Length,X-Request-Id');
    }

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }
    
    console.log('API catch-all: Forwarding valid request to Express')
    const app = require('../../index.js');
    return app(req, res);
    
  } catch (error) {
    console.error('API catch-all error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};