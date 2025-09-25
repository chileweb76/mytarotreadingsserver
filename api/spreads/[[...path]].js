const { connectToDatabase } = require('../../utils/connectToDatabase');

module.exports = async (req, res) => {
  try {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', 'https://mytarotreadings.vercel.app');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, x-vercel-blob-store');
    res.setHeader('Access-Control-Allow-Credentials', 'true');

    // Handle preflight OPTIONS request
    if (req.method === 'OPTIONS') {
      console.log('Spreads API: Handling OPTIONS preflight request');
      return res.status(200).end();
    }

    // Parse path segments after /api/spreads
    const host = req.headers.host || 'localhost';
    const pathname = new URL(req.url, `http://${host}`).pathname;
    const parts = pathname.split('/').filter(Boolean);
    const idx = parts.indexOf('spreads');
    const tail = idx >= 0 ? parts.slice(idx + 1) : [];

    await connectToDatabase();
    const Spread = require('../../models/Spread');

    if (tail.length === 0) {
      // Collection endpoints
      if (req.method === 'GET') {
        const spreads = await Spread.find({}).sort({ numberofCards: 1 });
        return res.status(200).json(spreads);
      }
      return res.status(405).json({ error: 'Method not allowed on /api/spreads' });
    }

    // tail[0] is the id
    const id = tail[0] || req.query?.id;
    if (!id) return res.status(400).json({ error: 'Spread ID is required' });

    if (req.method === 'GET') {
      const spread = await Spread.findById(id);
      if (!spread) return res.status(404).json({ error: 'Spread not found' });
      return res.status(200).json(spread);
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (error) {
    console.error('Spreads API Error:', error);
    res.status(500).json({ error: 'Internal server error', message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong' });
  }
};
