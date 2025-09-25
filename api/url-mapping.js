const { connectToDatabase } = require('../utils/connectToDatabase');

module.exports = async (req, res) => {
  try {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', 'https://mytarotreadings.vercel.app');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    res.setHeader('Access-Control-Allow-Credentials', 'true');

    // Handle preflight OPTIONS request
    if (req.method === 'OPTIONS') {
      console.log('URL Mapping: Handling OPTIONS preflight request');
      return res.status(200).end();
    }

    console.log(`URL Mapping: ${req.method} ${req.url}`);

    // Connect to database
    await connectToDatabase();
    
    // Get Rider-Waite deck and spreads
    const Deck = require('../models/Deck');
    const Spread = require('../models/Spread');
    
    const [deck, spreads] = await Promise.all([
      Deck.findOne({ deckName: 'Rider-Waite Tarot Deck', isGlobal: true }),
      Spread.find({})
    ]);
    
    const mapping = {};
    
    // Add deck cover mapping
    if (deck && deck.image) {
      mapping['/images/rider-waite-tarot/cover.jpg'] = deck.image;
      mapping['/images/rider-waite-tarot/cover.png'] = deck.image;
    }
    
    // Add card mappings
    if (deck && deck.cards) {
      deck.cards.forEach(card => {
        if (card.image) {
          // Create mappings for common filename patterns
          const cardSlug = card.name.toLowerCase()
            .replace(/^the /, '')
            .replace(/\s+/g, '_')
            .replace(/[^a-z0-9_]/g, '');
            
          mapping[`/images/rider-waite-tarot/major_arcana_${cardSlug}.png`] = card.image;
          mapping[`/images/rider-waite-tarot/major_arcana_${cardSlug}.jpg`] = card.image;
        }
      });
    }
    
    // Add spread mappings
    spreads.forEach(spread => {
      if (spread.image) {
        const spreadSlug = spread.spread.toLowerCase()
          .replace(/\s+/g, '_')
          .replace(/[^a-z0-9_]/g, '');
          
        mapping[`/images/spreads/${spreadSlug}.png`] = spread.image;
        mapping[`/images/spreads/${spreadSlug}.jpg`] = spread.image;
        mapping[`/images/spreads/${spreadSlug}.svg`] = spread.image;
      }
    });
    
    console.log(`URL Mapping: Generated ${Object.keys(mapping).length} mappings`);
    
    res.json({
      success: true,
      totalMappings: Object.keys(mapping).length,
      deckCards: deck?.cards?.length || 0,
      spreads: spreads.length,
      mapping
    });
    
  } catch (error) {
    console.error('URL Mapping Error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
    });
  }
};