const { allowedOrigins, allowedHostnames } = require('../../utils/corsConfig');

/**
 * Serverless function to handle CORS preflight and requests for /api/spreads/:id
 */
module.exports = async (req, res) => {
  try {
    const origin = req.headers.origin;
    const requestHost = req.headers.host;
    
    // Determine if origin is allowed
    let isAllowed = false;
    let allowedOrigin = null;
    
    if (origin) {
      // Check exact origin match
      if (allowedOrigins.includes(origin)) {
        isAllowed = true;
        allowedOrigin = origin;
      } else {
        // Check hostname match
        try {
          const originUrl = new URL(origin);
          const originHostname = originUrl.hostname;
          
          if (allowedHostnames.includes(originHostname)) {
            isAllowed = true;
            allowedOrigin = origin;
          }
          // Accept any .vercel.app subdomain as fallback
          else if (originHostname.endsWith('.vercel.app')) {
            isAllowed = true;
            allowedOrigin = origin;
          }
        } catch (e) {
          console.warn('Invalid origin URL:', origin);
        }
      }
    }
    
    // Fallback: check if request host should be allowed
    if (!isAllowed && requestHost) {
      if (allowedHostnames.includes(requestHost) || requestHost.endsWith('.vercel.app')) {
        isAllowed = true;
        allowedOrigin = origin || `https://${requestHost}`;
      }
    }
    
    // Handle OPTIONS preflight requests
    if (req.method === 'OPTIONS') {
      if (isAllowed && allowedOrigin) {
        res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
        res.setHeader('Vary', 'Origin');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        res.setHeader('Access-Control-Max-Age', '86400');
        return res.status(204).end();
      } else {
        return res.status(403).json({ error: 'Origin not allowed' });
      }
    }
    
    // For non-OPTIONS requests, forward to the main Express app
    const app = require('../../index.js');
    
    // Set CORS headers for the actual request
    if (isAllowed && allowedOrigin) {
      res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    }
    
    // Forward to Express app
    return app(req, res);
    
  } catch (error) {
    console.error('Spreads serverless error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
    });
  }
};