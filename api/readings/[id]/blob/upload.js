const { connectToDatabase } = require('../../../utils/connectToDatabase');

module.exports = async (req, res) => {
  try {
    const origin = req.headers.origin;
    console.log('Blob upload handler - Method:', req.method, 'URL:', req.url, 'Origin:', origin);

    // Set CORS headers immediately
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-user-id, X-Requested-With, Accept, Origin, x-vercel-blob-store');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Length,X-Request-Id');
    res.setHeader('Vary', 'Origin');

    // Handle OPTIONS preflight immediately
    if (req.method === 'OPTIONS') {
      console.log('Blob upload handler: Handling OPTIONS preflight, returning 200');
      return res.status(200).end();
    }

    // For non-OPTIONS requests, forward to Express app
    await connectToDatabase();
    const app = require('../../../index');
    return app(req, res);

  } catch (error) {
    console.error('Blob upload handler error:', error);
    
    // Ensure CORS headers are set even in error cases
    try {
      const origin = req.headers.origin;
      res.setHeader('Access-Control-Allow-Origin', origin || '*');
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Vary', 'Origin');
    } catch (corsError) {
      console.error('Failed to set CORS headers in error handler:', corsError);
    }
    
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
};