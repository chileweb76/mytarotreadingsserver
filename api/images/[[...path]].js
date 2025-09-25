const { connectToDatabase } = require('../../utils/connectToDatabase');

module.exports = async (req, res) => {
  try {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', 'https://mytarotreadings.vercel.app');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    res.setHeader('Access-Control-Allow-Credentials', 'true');

    // Handle preflight OPTIONS request
    if (req.method === 'OPTIONS') {
      console.log('Images API: Handling OPTIONS preflight request');
      return res.status(200).end();
    }

    // Parse the path to support nested routes like /api/images/rider-waite-tarot/:fileName
    const host = req.headers.host || 'localhost';
    const pathname = new URL(req.url, `http://${host}`).pathname;
    const parts = pathname.split('/').filter(Boolean);
    const idx = parts.indexOf('images');
    const tail = idx >= 0 ? parts.slice(idx + 1) : [];

    // If this looks like a Rider-Waite assets request, handle in-process (redirect to blob URL)
    if (tail[0] === 'rider-waite-tarot') {
      // fileName may be the next segment or provided as query param
      const fileName = tail[1] || req.query?.fileName;

      if (!fileName) {
        return res.status(400).json({ error: 'fileName parameter is required' });
      }

      console.log(`Rider-Waite Images: ${req.method} ${req.url}`, { fileName });

      // Connect to database and look up the Rider-Waite deck
      await connectToDatabase();
      const Deck = require('../../models/Deck');

      const deck = await Deck.findOne({ deckName: 'Rider-Waite Tarot Deck', isGlobal: true });
      if (!deck) {
        return res.status(404).json({ error: 'Rider-Waite deck not found' });
      }

      // Handle cover image
      if (['cover.svg', 'cover.jpg', 'cover.png'].includes(fileName)) {
        if (deck.image && deck.image.startsWith('https://')) {
          console.log(`Redirecting cover to: ${deck.image}`);
          return res.redirect(deck.image);
        }
      }

      // Attempt to infer card name from filename patterns
      if (fileName.includes('_')) {
        let cardName = fileName
          .replace(/^major_arcana_/, '')
          .replace(/^minor_arcana_/, '')
          .replace(/\.(png|jpg|svg)$/, '')
          .replace(/_/g, ' ')
          .replace(/\b\w/g, l => l.toUpperCase());

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

        const card = deck.cards.find(c =>
          c.name.toLowerCase() === cardName.toLowerCase() ||
          c.name.toLowerCase().includes(cardName.toLowerCase())
        );

        if (card && card.image && card.image.startsWith('https://')) {
          console.log(`Redirecting ${cardName} to: ${card.image}`);
          return res.redirect(card.image);
        }
      }

      return res.status(404).json({
        error: 'Image not found',
        message: `Could not find blob URL for ${fileName}`,
        suggestion: 'Use the /api/decks endpoint to get current blob URLs'
      });
    }

    // Otherwise, forward to the existing Express images router (preserves previous behavior)
    console.log(`Images API: ${req.method} ${req.url}`, {
      origin: req.headers.origin,
      query: req.query
    });

    const express = require('express');
    const imagesRouter = require('../../routes/images');

    const app = express();
    app.use('/', imagesRouter);
    return app(req, res);

  } catch (error) {
    console.error('Images API Error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
    });
  }
};
