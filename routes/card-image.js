const express = require('express')
const router = express.Router()
const Deck = require('../models/Deck')

// Get card image by name and deck
router.get('/', async (req, res) => {
  try {
    const { name, deck: deckName } = req.query
    
    if (!name) {
      return res.status(400).json({ error: 'Card name is required' })
    }

    // Default to Rider-Waite if no deck specified
    const searchDeckName = deckName || 'rider-waite'
    
    // Handle Rider-Waite static images
    if (searchDeckName === 'rider-waite') {
      // For Rider-Waite, we can construct static image paths
      const imageUrl = generateRiderWaiteImageUrl(name)
      if (imageUrl) {
        return res.json({ imageUrl })
      } else {
        return res.json({ imageUrl: null })
      }
    }

    // For other decks, look up in database
    const deck = await Deck.findOne({ 
      deckName: { $regex: new RegExp(searchDeckName, 'i') } 
    })
    
    if (!deck) {
      return res.status(404).json({ error: 'Deck not found' })
    }

    // Find card by name (case-insensitive)
    const card = deck.cards.find(c => 
      (c.name || '').toLowerCase() === name.toLowerCase()
    )

    if (card && card.image) {
      res.json({ imageUrl: card.image })
    } else {
      res.json({ imageUrl: null })
    }

  } catch (error) {
    console.error('Error fetching card image:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Helper function to generate Rider-Waite image URLs
function generateRiderWaiteImageUrl(cardName) {
  if (!cardName) return null
  
  // Major Arcana cards
  const majorArcana = [
    'The Fool', 'The Magician', 'The High Priestess', 'The Empress', 'The Emperor',
    'The Hierophant', 'The Lovers', 'The Chariot', 'Strength', 'The Hermit',
    'Wheel of Fortune', 'Justice', 'The Hanged Man', 'Death', 'Temperance',
    'The Devil', 'The Tower', 'The Star', 'The Moon', 'The Sun', 'Judgement', 'The World'
  ]
  
  // Check if it's a Major Arcana card
  const isMajorArcana = majorArcana.some(major => 
    major.toLowerCase() === cardName.toLowerCase()
  )
  
  if (isMajorArcana) {
    // For Major Arcana: major_arcana_<name>.png
    let fileName = cardName.toLowerCase()
      .replace(/^the\s+/i, '') // Remove "The" prefix
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_]/g, '')
    
    // Handle special cases
    if (fileName === 'wheel_of_fortune') fileName = 'fortune'
    if (fileName === 'hanged_man') fileName = 'hanged'
    if (fileName === 'high_priestess') fileName = 'priestess'
    
    return `/images/rider-waite-tarot/major_arcana_${fileName}.png`
  } else {
    // For spread position names or unknown cards, return null
    return null
  }
}

module.exports = router