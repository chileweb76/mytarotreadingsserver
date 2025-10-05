const { connectToDatabase } = require('../utils/connectToDatabase');

// Defensive import with fallback for allowedOrigins
let allowedOrigins = ['http://localhost:3000']; // fallback default
try {
  const corsConfig = require('../utils/corsConfig');
  allowedOrigins = corsConfig.allowedOrigins || ['http://localhost:3000'];
} catch (e) {
  console.error('Failed to import corsConfig, using fallback allowedOrigins:', e.message);
}

/**
 * Unified serverless catch-all handler for Vercel deployments.
 * Sets permissive CORS for debugging and forwards requests to the
 * Express app after ensuring the database is initialized.
 */
module.exports = async (req, res) => {
  const origin = req.headers.origin;

  // IMMEDIATELY set CORS headers before anything else
  res.setHeader('Access-Control-Allow-Origin', origin || '*');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-user-id, X-Requested-With, Accept, Origin, x-vercel-blob-store');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Length, X-Request-Id');
  res.setHeader('Vary', 'Origin');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  // Short-circuit preflight requests IMMEDIATELY
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  try {
    // Ensure DB connection is ready for non-OPTIONS requests
    await connectToDatabase();

    // Forward to the main Express app to handle routing and responses
    const app = require('../index.js');
    return app(req, res);

  } catch (error) {
    console.error('Catch-all handler error:', error);
    // Ensure CORS headers are still set on error responses
    res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    // If preflight, return 204; otherwise return 500
    if (req.method === 'OPTIONS') return res.status(204).end();
    return res.status(500).json({ error: 'Internal server error', message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong' });
  }
};