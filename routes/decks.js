const express = require('express')
const router = express.Router()
const Deck = require('../models/Deck')
const multer = require('multer')
const path = require('path')
const fs = require('fs')
const passport = require('passport')

// Multer setup for deck card uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const deckId = req.params.deckId
    const dest = path.join(__dirname, '..', 'uploads', 'decks', deckId)
    fs.mkdirSync(dest, { recursive: true })
    cb(null, dest)
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname)
    const safeName = req.params.cardName.replace(/[^a-z0-9-_\.]/gi, '_')
    cb(null, `${safeName}${ext}`)
  }
})

const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } })

// Upload a card image for a deck
router.post('/:deckId/card/:cardName/upload', upload.single('card'), async (req, res) => {
  try {
    const { deckId, cardName } = req.params
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' })
    const deck = await Deck.findById(deckId)
    if (!deck) return res.status(404).json({ error: 'Deck not found' })

    // Check if this is the Rider-Waite deck - prevent editing
    if (deck.deckName === 'Rider-Waite Tarot Deck') {
      return res.status(403).json({ error: 'Rider-Waite Tarot cards cannot be edited' })
    }

    const webPath = `${req.protocol}://${req.get('host')}/uploads/decks/${deckId}/${req.file.filename}`

    // find matching card by name (case-insensitive) and update image
    const card = deck.cards.find(c => (c.name || '').toLowerCase() === (cardName || '').toLowerCase())
    if (card) {
      card.image = webPath
    } else {
      // if not found, push new card
      deck.cards.push({ name: cardName, image: webPath })
    }

    await deck.save()

    res.json({ success: true, card: card || deck.cards[deck.cards.length - 1] })
  } catch (err) {
    console.error('Card upload error', err)
    res.status(500).json({ error: 'Upload failed' })
  }
})

// Upload a deck cover image
router.post('/:deckId/upload', upload.single('image'), async (req, res) => {
  try {
    const { deckId } = req.params
    const { cardName } = req.body // Check if this is a card upload
    
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' })
    const deck = await Deck.findById(deckId)
    if (!deck) return res.status(404).json({ error: 'Deck not found' })

    // Check if this is the Rider-Waite deck - prevent editing
    if (deck.deckName === 'Rider-Waite Tarot Deck') {
      return res.status(403).json({ error: 'Rider-Waite Tarot cards cannot be edited' })
    }

    const webPath = `${req.protocol}://${req.get('host')}/uploads/decks/${deckId}/${req.file.filename}`
    
    if (cardName) {
      // This is a card upload
      const card = deck.cards.find(c => (c.name || '').toLowerCase() === (cardName || '').toLowerCase())
      if (card) {
        card.image = webPath
      } else {
        // if not found, push new card
        deck.cards.push({ name: cardName, image: webPath })
      }
      await deck.save()
      res.json({ success: true, card: card || deck.cards[deck.cards.length - 1] })
    } else {
      // This is a deck image upload
      deck.image = webPath
      await deck.save()
      res.json({ success: true, deck: { _id: deck._id, deckName: deck.deckName, image: deck.image } })
    }
  } catch (err) {
    console.error('Upload error', err)
    res.status(500).json({ error: 'Upload failed' })
  }
})

// Rename a card in a deck (match by cardName param, case-insensitive)
router.put('/:deckId/card/:cardName', async (req, res) => {
  try {
    const { deckId, cardName } = req.params
    const { newName } = req.body
    if (!newName || !newName.trim()) return res.status(400).json({ error: 'newName is required' })

    const deck = await Deck.findById(deckId)
    if (!deck) return res.status(404).json({ error: 'Deck not found' })

  const idx = deck.cards.findIndex(c => (c.name || '').toLowerCase() === (cardName || '').toLowerCase())
  if (idx === -1) return res.status(404).json({ error: 'Card not found' })

  // Prevent duplicate card names within the same deck (case-insensitive)
  const duplicate = deck.cards.findIndex((c, i) => i !== idx && (c.name || '').toLowerCase() === (newName || '').toLowerCase())
  if (duplicate !== -1) return res.status(409).json({ error: 'Another card with that name already exists in this deck' })

  deck.cards[idx].name = newName.trim()
  await deck.save()

  res.json({ success: true, card: deck.cards[idx] })
  } catch (err) {
    console.error('Error renaming card', err)
    res.status(500).json({ error: 'Failed to rename card' })
  }
})

// Get all decks
router.get('/', async (req, res) => {
  try {
    const decks = await Deck.find({})
    res.json(decks)
  } catch (err) {
    console.error('Error fetching decks', err)
    res.status(500).json({ error: 'Failed to fetch decks' })
  }
})

// Get a single deck by id
router.get('/:id', async (req, res) => {
  try {
    const deck = await Deck.findById(req.params.id)
    if (!deck) return res.status(404).json({ error: 'Deck not found' })
    res.json(deck)
  } catch (err) {
    console.error('Error fetching deck', err)
    res.status(500).json({ error: 'Failed to fetch deck' })
  }
})

// Create a new deck (authenticated)
router.post('/', passport.authenticate('jwt', { session: false }), async (req, res) => {
  try {
    const { deckName, description, cards } = req.body
    if (!deckName) return res.status(400).json({ error: 'deckName is required' })
  // Prevent duplicate deck names (case-insensitive)
  const escapeReg = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const existing = await Deck.findOne({ deckName: { $regex: `^${escapeReg(deckName)}$`, $options: 'i' } })
  if (existing) return res.status(409).json({ error: 'A deck with that name already exists' })

  // If no cards provided, populate with the standard 78 tarot card names
    const defaultCards = [
      // Major Arcana
      'The Fool','The Magician','The High Priestess','The Empress','The Emperor','The Hierophant','The Lovers','The Chariot','Strength','The Hermit','Wheel of Fortune','Justice','The Hanged Man','Death','Temperance','The Devil','The Tower','The Star','The Moon','The Sun','Judgement','The World',
      // Minor Arcana - Wands
      'Ace of Wands','Two of Wands','Three of Wands','Four of Wands','Five of Wands','Six of Wands','Seven of Wands','Eight of Wands','Nine of Wands','Ten of Wands','Page of Wands','Knight of Wands','Queen of Wands','King of Wands',
      // Cups
      'Ace of Cups','Two of Cups','Three of Cups','Four of Cups','Five of Cups','Six of Cups','Seven of Cups','Eight of Cups','Nine of Cups','Ten of Cups','Page of Cups','Knight of Cups','Queen of Cups','King of Cups',
      // Swords
      'Ace of Swords','Two of Swords','Three of Swords','Four of Swords','Five of Swords','Six of Swords','Seven of Swords','Eight of Swords','Nine of Swords','Ten of Swords','Page of Swords','Knight of Swords','Queen of Swords','King of Swords',
      // Pentacles
      'Ace of Pentacles','Two of Pentacles','Three of Pentacles','Four of Pentacles','Five of Pentacles','Six of Pentacles','Seven of Pentacles','Eight of Pentacles','Nine of Pentacles','Ten of Pentacles','Page of Pentacles','Knight of Pentacles','Queen of Pentacles','King of Pentacles'
    ]

    const cardsToSave = Array.isArray(cards) && cards.length ? cards : defaultCards.map(name => ({ name, image: '' }))

  const owner = req.user && (req.user.id || req.user._id) ? (req.user.id || req.user._id) : null
  const deckData = { deckName, description, cards: cardsToSave }
  if (owner) deckData.owner = owner

  const deck = new Deck(deckData)
    await deck.save()
    res.status(201).json(deck)
  } catch (err) {
    console.error('Error creating deck', err)
    res.status(500).json({ error: 'Failed to create deck' })
  }
})

// Delete a deck by id (protected)
async function deleteDeckHandler(req, res) {
  try {
    const { id } = req.params
    const deck = await Deck.findById(id)
    if (!deck) return res.status(404).json({ error: 'Deck not found' })

    // If deck has an owner, only allow the owner to delete
    if (deck.owner) {
      const ownerId = deck.owner.toString()
      const userId = req.user && (req.user.id || req.user._id) ? (req.user.id || req.user._id).toString() : null
      if (!userId || ownerId !== userId) return res.status(403).json({ error: 'Not authorized to delete this deck' })
    }

    // delete deck document
    await Deck.findByIdAndDelete(id)

    // attempt to remove uploaded files for this deck (async when possible)
    try {
      const uploadsPath = path.join(__dirname, '..', 'uploads', 'decks', id)
      const fsp = fs.promises
      if (fsp && typeof fsp.rm === 'function') {
        await fsp.rm(uploadsPath, { recursive: true, force: true })
      } else if (fsp && typeof fsp.rmdir === 'function') {
        // older Node versions may have rmdir with recursive
        await fsp.rmdir(uploadsPath, { recursive: true })
      } else {
        // fallback to sync removal as last resort
        if (fs.existsSync(uploadsPath)) {
          if (typeof fs.rm === 'function') {
            fs.rmSync(uploadsPath, { recursive: true, force: true })
          } else {
            fs.rmdirSync(uploadsPath, { recursive: true })
          }
        }
      }
    } catch (e) {
      console.warn('Failed to cleanup uploads for deck', id, e)
    }

    return res.json({ success: true })
  } catch (err) {
    console.error('Error deleting deck', err)
    return res.status(500).json({ error: 'Failed to delete deck' })
  }
}

// protected route using passport
router.delete('/:id', passport.authenticate('jwt', { session: false }), deleteDeckHandler)

// also expose handler for unit tests
module.exports = router
// attach handler for tests
module.exports.deleteDeckHandler = deleteDeckHandler

