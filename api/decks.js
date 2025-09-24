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
      console.log('Decks API: Handling OPTIONS preflight request');
      return res.status(200).end();
    }

    console.log(`Decks API: ${req.method} ${req.url}`, {
      origin: req.headers.origin,
      query: req.query
    });

    // Connect to database
    await connectToDatabase();
    const Deck = require('../models/Deck');

    if (req.method === 'GET') {
      // Check if requesting specific deck by ID
      const { id } = req.query;
      
      if (id) {
        // Get specific deck
        const deck = await Deck.findById(id);
        if (!deck) {
          return res.status(404).json({ error: 'Deck not found' });
        }
        return res.status(200).json(deck);
      } else {
        // Get all decks (including global ones)
        const decks = await Deck.find({}).sort({ createdAt: -1 });
        return res.status(200).json(decks);
      }
    }

    // For now, only support GET requests
    res.status(405).json({ error: 'Method not allowed' });

  } catch (error) {
    console.error('Decks API Error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
    });
  }
};