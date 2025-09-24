const { connectToDatabase } = require('../utils/connectToDatabase');

module.exports = async (req, res) => {
  try {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', 'https://mytarotreadings.vercel.app');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, x-vercel-blob-store');
    res.setHeader('Access-Control-Allow-Credentials', 'true');

    // Handle preflight OPTIONS request
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    // Connect to database
    await connectToDatabase();
    const Spread = require('../models/Spread');

    if (req.method === 'GET') {
      // Get all spreads or specific spread by ID
      const spreads = await Spread.find({}).sort({ numberofCards: 1 });
      return res.status(200).json(spreads);
    }

    res.status(405).json({ error: 'Method not allowed' });

  } catch (error) {
    console.error('Spreads API Error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
    });
  }
};