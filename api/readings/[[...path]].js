const { connectToDatabase } = require('../../utils/connectToDatabase');
const { allowedOrigins } = require('../../utils/corsConfig');

module.exports = async (req, res) => {
  try {
    const origin = req.headers.origin;
    console.log('Readings merged handler - Method:', req.method, 'URL:', req.url, 'Origin:', origin);

    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-user-id, X-Requested-With, Accept, Origin, x-vercel-blob-store');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Length,X-Request-Id');
    res.setHeader('Vary', 'Origin');

    if (req.method === 'OPTIONS') {
      console.log('Readings merged handler: Handling OPTIONS preflight');
      return res.status(200).end();
    }

    // Parse path segments after /api/readings
    const host = req.headers.host || 'localhost';
    const pathname = new URL(req.url, `http://${host}`).pathname;
    const parts = pathname.split('/').filter(Boolean);
    const idx = parts.indexOf('readings');
    const tail = idx >= 0 ? parts.slice(idx + 1) : [];

    await connectToDatabase();

    // If no tail -> collection endpoints
    if (tail.length === 0) {
      // GET /api/readings -> forward to main Express app for collection handling
      if (req.method === 'GET' || req.method === 'POST') {
        const app = require('../../index');
        return app(req, res);
      }
      return res.status(405).json({ error: 'Method not allowed on /api/readings' });
    }

    // tail[0] should be id
    const id = tail[0] || req.query?.id;
    if (!id) return res.status(400).json({ error: 'Reading ID is required' });

    // Nested handlers: /api/readings/:id/image and /api/readings/:id/blob/upload
    if (tail[1] === 'image') {
      // Forward to express for image handling
      const app = require('../../index');
      return app(req, res);
    }

    if (tail[1] === 'blob' && tail[2] === 'upload') {
      // Forward to express - the express app handles blob uploads
      const app = require('../../index');
      return app(req, res);
    }

    // Default per-id handlers: GET/PUT/DELETE -> forward to express for full behavior
    if (['GET', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
      const app = require('../../index');
      return app(req, res);
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (error) {
    console.error('Readings merged handler error:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
};
