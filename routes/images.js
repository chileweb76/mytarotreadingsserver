const express = require('express');
const router = express.Router();

/**
 * Image serving routes for spreads and decks
 * Replaces frontend image serving with backend Vercel Blob URLs
 */

// Get spread image by spread ID
router.get('/spreads/:id', async (req, res) => {
  try {
    const Spread = require('../models/Spread');
    const spread = await Spread.findById(req.params.id);
    
    if (!spread) {
      return res.status(404).json({ error: 'Spread not found' });
    }
    
    if (!spread.image) {
      return res.status(404).json({ error: 'Spread image not found' });
    }
    
    // If it's already a blob URL, redirect to it
    if (spread.image.startsWith('https://')) {
      return res.redirect(spread.image);
    }
    
    // If it's still a local path, return the frontend URL (fallback)
    if (spread.image.startsWith('/images/')) {
      const frontendUrl = `https://mytarotreadings.vercel.app${spread.image}`;
      return res.redirect(frontendUrl);
    }
    
    res.json({ imageUrl: spread.image });
  } catch (error) {
    console.error('Error serving spread image:', error);
    res.status(500).json({ error: 'Failed to serve spread image' });
  }
});

// Get deck cover image by deck ID
router.get('/decks/:id/cover', async (req, res) => {
  try {
    const Deck = require('../models/Deck');
    const deck = await Deck.findById(req.params.id);
    
    if (!deck) {
      return res.status(404).json({ error: 'Deck not found' });
    }
    
    if (!deck.image) {
      return res.status(404).json({ error: 'Deck cover image not found' });
    }
    
    // If it's already a blob URL, redirect to it
    if (deck.image.startsWith('https://')) {
      return res.redirect(deck.image);
    }
    
    // If it's still a local path, return the frontend URL (fallback)
    if (deck.image.startsWith('/images/')) {
      const frontendUrl = `https://mytarotreadings.vercel.app${deck.image}`;
      return res.redirect(frontendUrl);
    }
    
    res.json({ imageUrl: deck.image });
  } catch (error) {
    console.error('Error serving deck cover image:', error);
    res.status(500).json({ error: 'Failed to serve deck cover image' });
  }
});

// Get deck card image by deck ID and card name
router.get('/decks/:id/cards/:cardName', async (req, res) => {
  try {
    const Deck = require('../models/Deck');
    const deck = await Deck.findById(req.params.id);
    
    if (!deck) {
      return res.status(404).json({ error: 'Deck not found' });
    }
    
    const cardName = decodeURIComponent(req.params.cardName);
    const card = deck.cards.find(c => c.name === cardName);
    
    if (!card || !card.image) {
      return res.status(404).json({ error: 'Card image not found' });
    }
    
    // If it's already a blob URL, redirect to it
    if (card.image.startsWith('https://')) {
      return res.redirect(card.image);
    }
    
    // If it's still a local path, return the frontend URL (fallback)
    if (card.image.startsWith('/images/')) {
      const frontendUrl = `https://mytarotreadings.vercel.app${card.image}`;
      return res.redirect(frontendUrl);
    }
    
    res.json({ imageUrl: card.image });
  } catch (error) {
    console.error('Error serving card image:', error);
    res.status(500).json({ error: 'Failed to serve card image' });
  }
});

// List all available spread images
router.get('/spreads', async (req, res) => {
  try {
    const Spread = require('../models/Spread');
    const spreads = await Spread.find({}, 'spread image _id');
    
    const imageMap = spreads.reduce((acc, spread) => {
      if (spread.image) {
        acc[spread._id] = {
          name: spread.spread,
          imageUrl: spread.image.startsWith('https://') ? 
            spread.image : 
            spread.image.startsWith('/images/') ? 
              `https://mytarotreadings.vercel.app${spread.image}` : 
              spread.image
        };
      }
      return acc;
    }, {});
    
    res.json(imageMap);
  } catch (error) {
    console.error('Error listing spread images:', error);
    res.status(500).json({ error: 'Failed to list spread images' });
  }
});

// List all available deck cover images
router.get('/decks', async (req, res) => {
  try {
    const Deck = require('../models/Deck');
    const decks = await Deck.find({}, 'deckName image _id');
    
    const imageMap = decks.reduce((acc, deck) => {
      if (deck.image) {
        acc[deck._id] = {
          name: deck.deckName,
          imageUrl: deck.image.startsWith('https://') ? 
            deck.image : 
            deck.image.startsWith('/images/') ? 
              `https://mytarotreadings.vercel.app${deck.image}` : 
              deck.image
        };
      }
      return acc;
    }, {});
    
    res.json(imageMap);
  } catch (error) {
    console.error('Error listing deck images:', error);
    res.status(500).json({ error: 'Failed to list deck images' });
  }
});

module.exports = router;