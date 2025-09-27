const { connectToDatabase } = require('../utils/connectToDatabase');

module.exports = async (req, res) => {
  try {
    const origin = req.headers.origin;
    console.log('Dedicated blob upload handler - Method:', req.method, 'URL:', req.url, 'Origin:', origin);

    // Set CORS headers immediately
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-user-id, X-Requested-With, Accept, Origin, x-vercel-blob-store');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Length,X-Request-Id');
    res.setHeader('Vary', 'Origin');

    // Handle OPTIONS preflight immediately
    if (req.method === 'OPTIONS') {
      console.log('Dedicated blob upload handler: Handling OPTIONS preflight, returning 200');
      return res.status(200).end();
    }

    // For non-OPTIONS requests, connect to database and forward to Express app
    await connectToDatabase();
    
    // Parse the reading ID from the query parameters
    const readingId = req.query.id;
    console.log('Blob upload for reading ID:', readingId);
    console.log('Request headers:', Object.keys(req.headers));
    console.log('Content-Type:', req.headers['content-type']);
    
    if (!readingId) {
      return res.status(400).json({ error: 'Reading ID is required as query parameter' });
    }
    
    // Modify the request to match what the Express route expects
    req.params = { id: readingId };
    req.url = `/api/readings/${readingId}/blob/upload`;
    
    const app = require('../index');
    return app(req, res);

  } catch (error) {
    console.error('Dedicated blob upload handler error:', error);
    
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