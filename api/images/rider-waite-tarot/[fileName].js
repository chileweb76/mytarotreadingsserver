const { connectToDatabase } = require('../../utils/connectToDatabase');

module.exports = async (req, res) => {
  try {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', 'https://mytarotreadings.vercel.app');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    res.setHeader('Access-Control-Allow-Credentials', 'true');

    // Handle preflight OPTIONS request
    if (req.method === 'OPTIONS') {
      console.log('Rider-Waite Images: Handling OPTIONS preflight request');
      return res.status(200).end();
    }

    const { fileName } = req.query;
    console.log(`Rider-Waite Images: ${req.method} ${req.url}`, { fileName });

    if (!fileName) {
      return res.status(400).json({ error: 'fileName parameter is required' });
    }

    // Connect to database
    await connectToDatabase();
    const Deck = require('../../models/Deck');
    
    // Find the Rider-Waite deck
    const deck = await Deck.findOne({ 
      deckName: 'Rider-Waite Tarot Deck',
      isGlobal: true
    });
    
    if (!deck) {
      return res.status(404).json({ error: 'Rider-Waite deck not found' });
    }
    
    // Handle cover image
    if (fileName === 'cover.svg' || fileName === 'cover.jpg' || fileName === 'cover.png') {
      if (deck.image && deck.image.startsWith('https://')) {
        console.log(`Redirecting cover to: ${deck.image}`);
        return res.redirect(deck.image);
      }
    }
    
    // Handle card images - try to match by filename
    if (fileName.includes('_')) {
      // Convert filename patterns like "major_arcana_fool.png" to card names
      let cardName = fileName
        .replace(/^major_arcana_/, '')
        .replace(/^minor_arcana_/, '')
        .replace(/\.(png|jpg|svg)$/, '')
        .replace(/_/g, ' ')
        .replace(/\b\w/g, l => l.toUpperCase());
      
      // Special mappings for common variations
      const nameMapping = {
        'Fool': 'The Fool',
        'Magician': 'The Magician',
        'Priestess': 'The High Priestess',
        'Empress': 'The Empress',
        'Emperor': 'The Emperor',
        'Hierophant': 'The Hierophant',
        'Lovers': 'The Lovers',
        'Chariot': 'The Chariot',
        'Strength': 'Strength',
        'Hermit': 'The Hermit',
        'Fortune': 'Wheel of Fortune',
        'Justice': 'Justice',
        'Hanged': 'The Hanged Man',
        'Death': 'Death',
        'Temperance': 'Temperance',
        'Devil': 'The Devil',
        'Tower': 'The Tower',
        'Star': 'The Star',
        'Moon': 'The Moon',
        'Sun': 'The Sun',
        'Judgement': 'Judgement',
        'World': 'The World'
      };
      
      if (nameMapping[cardName]) {
        cardName = nameMapping[cardName];
      }
      
      // Find the card in the deck
      const card = deck.cards.find(c => 
        c.name.toLowerCase() === cardName.toLowerCase() ||
        c.name.toLowerCase().includes(cardName.toLowerCase())
      );
      
      if (card && card.image && card.image.startsWith('https://')) {
        console.log(`Redirecting ${cardName} to: ${card.image}`);
        return res.redirect(card.image);
      }
    }
    
    // If we can't find a specific match, return 404
    res.status(404).json({ 
      error: 'Image not found',
      message: `Could not find blob URL for ${fileName}`,
      suggestion: 'Use the /api/decks endpoint to get current blob URLs'
    });
    
  } catch (error) {
    console.error('Rider-Waite Images Error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
    });
  }
};