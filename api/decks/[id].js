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
      console.log('Decks API: Handling OPTIONS preflight request for ID');
      return res.status(200).end();
    }

    console.log(`Decks API [ID]: ${req.method} ${req.url}`, {
      origin: req.headers.origin,
      query: req.query
    });

    // Connect to database
    await connectToDatabase();
    const Deck = require('../../models/Deck');

    if (req.method === 'GET') {
      // Get deck ID from the URL path
      const { id } = req.query;
      
      if (!id) {
        return res.status(400).json({ error: 'Deck ID is required' });
      }

      // Get specific deck by ID
      const deck = await Deck.findById(id);
      if (!deck) {
        return res.status(404).json({ error: 'Deck not found' });
      }
      
      return res.status(200).json(deck);
    }

    // For now, only support GET requests
    res.status(405).json({ error: 'Method not allowed' });

  } catch (error) {
    console.error('Decks API [ID] Error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
    });
  }
};