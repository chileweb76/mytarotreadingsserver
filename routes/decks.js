const express = require('express')
const router = express.Router()
const Deck = require('../models/Deck')
const multer = require('multer')
const path = require('path')
const fs = require('fs')
const passport = require('passport')
const logger = require('../lib/logger')
const { uploadDeckCover, uploadDeckCard, createDeckFolderStructure } = require('../utils/deckBlobStorage')

// Multer setup for in-memory buffer upload (will upload to blob)
const storage = multer.memoryStorage()
const upload = multer({ 
  storage, 
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase())
    const mimetype = allowedTypes.test(file.mimetype)
    
    if (mimetype && extname) {
      return cb(null, true)
    } else {
      cb(new Error('Only image files are allowed'))
    }
  }
})

// GET /api/decks - Get all decks (global and user-owned)
router.get('/', (req, res, next) => {
  // Try to authenticate, but don't fail if no auth
  passport.authenticate('jwt', { session: false }, (err, user) => {
    if (user) req.user = user
    next()
  })(req, res, next)
}, async (req, res) => {
  try {
    let query = {}
    
    // If user is authenticated, get both global and user decks
    if (req.user) {
      query = {
        $or: [
          { owner: req.user._id },
          { owner: null },
          { owner: { $exists: false } },
          { isGlobal: true }
        ]
      }
    } else {
      // If not authenticated, only get global decks
      query = {
        $or: [
          { owner: null },
          { owner: { $exists: false } },
          { isGlobal: true }
        ]
      }
    }

    const decks = await Deck.find(query).sort({ deckName: 1 })
    
    // Normalize deck data
    const normalizedDecks = decks.map(deck => ({
      _id: deck._id.toString(),
      deckName: deck.deckName,
      description: deck.description,
      image: deck.image,
      owner: deck.owner ? deck.owner.toString() : null,
      isGlobal: !deck.owner || deck.isGlobal === true,
      cardCount: deck.cards ? deck.cards.length : 0,
      createdAt: deck.createdAt,
      updatedAt: deck.updatedAt
    }))

    res.json({ success: true, decks: normalizedDecks })
  } catch (err) {
    logger.error('Error fetching decks:', err)
    res.status(500).json({ error: 'Failed to fetch decks' })
  }
})

// GET /api/decks/global - Get only global decks (no auth required)
router.get('/global', async (req, res) => {
  try {
    const decks = await Deck.find({
      $or: [
        { owner: null },
        { owner: { $exists: false } },
        { isGlobal: true }
      ]
    }).sort({ deckName: 1 })

    const normalizedDecks = decks.map(deck => ({
      _id: deck._id.toString(),
      deckName: deck.deckName,
      description: deck.description,
      image: deck.image,
      owner: null,
      isGlobal: true,
      cardCount: deck.cards ? deck.cards.length : 0,
      createdAt: deck.createdAt,
      updatedAt: deck.updatedAt
    }))

    res.json({ success: true, decks: normalizedDecks })
  } catch (err) {
    logger.error('Error fetching global decks:', err)
    res.status(500).json({ error: 'Failed to fetch global decks' })
  }
})

// GET /api/decks/:id - Get a specific deck with cards
router.get('/:id', (req, res, next) => {
  // Try to authenticate, but don't fail if no auth
  passport.authenticate('jwt', { session: false }, (err, user) => {
    if (user) req.user = user
    next()
  })(req, res, next)
}, async (req, res) => {
  try {
    const deck = await Deck.findById(req.params.id)
    if (!deck) {
      return res.status(404).json({ error: 'Deck not found' })
    }

    // Check permissions - global decks are always accessible
    if (deck.owner && !deck.isGlobal) {
      if (!req.user || deck.owner.toString() !== req.user._id.toString()) {
        return res.status(403).json({ error: 'Access denied' })
      }
    }

    const normalizedDeck = {
      _id: deck._id.toString(),
      deckName: deck.deckName,
      description: deck.description,
      image: deck.image,
      owner: deck.owner ? deck.owner.toString() : null,
      isGlobal: !deck.owner || deck.isGlobal === true,
      cards: deck.cards || [],
      createdAt: deck.createdAt,
      updatedAt: deck.updatedAt
    }

    res.json({ success: true, deck: normalizedDeck })
  } catch (err) {
    logger.error('Error fetching deck:', err)
    res.status(500).json({ error: 'Failed to fetch deck' })
  }
})

// Upload a card image for a deck
router.post('/:deckId/card/:cardName/upload', 
  passport.authenticate('jwt', { session: false }),
  upload.single('card'), 
  async (req, res) => {
    try {
      const { deckId, cardName } = req.params
      if (!req.file) return res.status(400).json({ error: 'No file uploaded' })
      
      const deck = await Deck.findById(deckId)
      if (!deck) return res.status(404).json({ error: 'Deck not found' })

      // Check if this is the Rider-Waite deck - prevent editing
      if (deck.deckName === 'Rider-Waite Tarot Deck') {
        return res.status(403).json({ error: 'Rider-Waite Tarot cards cannot be edited' })
      }

      // Verify ownership
      const ownerId = deck.owner?.toString()
      const userId = req.user?._id?.toString() || req.user?.id?.toString()
      if (!ownerId || !userId || ownerId !== userId) {
        return res.status(403).json({ error: 'Not authorized to edit this deck' })
      }

      // Upload to blob with hierarchical structure
      const result = await uploadDeckCard(
        req.file.buffer,
        req.file.originalname,
        cardName,
        deckId,
        ownerId
      )

      // Find matching card by name (case-insensitive) and update image
      const card = deck.cards.find(c => (c.name || '').toLowerCase() === (cardName || '').toLowerCase())
      if (card) {
        card.image = result.url
      } else {
        // If not found, push new card
        deck.cards.push({ name: cardName, image: result.url })
      }

      await deck.save()

      res.json({ 
        success: true, 
        card: card || deck.cards[deck.cards.length - 1],
        blobPath: result.pathname
      })
    } catch (err) {
      logger.error('Card upload error', err)
      res.status(500).json({ error: err.message || 'Upload failed' })
    }
  }
)

// Upload a deck cover image
router.post('/:deckId/upload', 
  passport.authenticate('jwt', { session: false }),
  upload.single('image'), 
  async (req, res) => {
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

      // Verify ownership
      const ownerId = deck.owner?.toString()
      const userId = req.user?._id?.toString() || req.user?.id?.toString()
      if (!ownerId || !userId || ownerId !== userId) {
        return res.status(403).json({ error: 'Not authorized to edit this deck' })
      }
      
      if (cardName) {
        // This is a card upload - use hierarchical blob storage
        const result = await uploadDeckCard(
          req.file.buffer,
          req.file.originalname,
          cardName,
          deckId,
          ownerId
        )
        
        const card = deck.cards.find(c => (c.name || '').toLowerCase() === (cardName || '').toLowerCase())
        if (card) {
          card.image = result.url
        } else {
          // If not found, push new card
          deck.cards.push({ name: cardName, image: result.url })
        }
        await deck.save()
        res.json({ 
          success: true, 
          card: card || deck.cards[deck.cards.length - 1],
          blobPath: result.pathname
        })
      } else {
        // This is a deck cover image upload - use hierarchical blob storage
        const result = await uploadDeckCover(
          req.file.buffer,
          req.file.originalname,
          deckId,
          ownerId
        )
        
        deck.image = result.url
        await deck.save()
        res.json({ 
          success: true, 
          deck: { 
            _id: deck._id, 
            deckName: deck.deckName, 
            image: deck.image 
          },
          blobPath: result.pathname
        })
      }
    } catch (err) {
      logger.error('Upload error', err)
      res.status(500).json({ error: err.message || 'Upload failed' })
    }
  }
)

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
    logger.error('Error renaming card', err)
    res.status(500).json({ error: 'Failed to rename card' })
  }
})

// Get all decks (global decks + user's decks if authenticated)
router.get('/', async (req, res) => {
  try {
    let query = {};
    
    // Always include global decks
    if (req.user) {
      // If authenticated, get global decks + user's decks
      query = {
        $or: [
          { isGlobal: true },
          { owner: req.user.id }
        ]
      };
    } else {
      // If not authenticated, only show global decks
      query = { isGlobal: true };
    }
    
    const decks = await Deck.find(query).sort({ isGlobal: -1, createdAt: -1 });
    
    // Add metadata to distinguish global vs user decks
    const decksWithMetadata = decks.map(deck => ({
      ...deck.toObject(),
      isUserDeck: deck.owner && req.user && deck.owner.toString() === req.user.id,
      isGlobalDeck: deck.isGlobal || !deck.owner
    }));
    
    res.json(decksWithMetadata);
  } catch (err) {
    logger.error('Error fetching decks', err);
    res.status(500).json({ error: 'Failed to fetch decks' });
  }
});

// Get only global decks
router.get('/global', async (req, res) => {
  try {
    const globalDecks = await Deck.find({ 
      $or: [
        { isGlobal: true },
        { owner: null }
      ]
    }).sort({ createdAt: -1 });
    
    res.json({
      message: 'Global decks available to all users',
      count: globalDecks.length,
      decks: globalDecks
    });
  } catch (err) {
    logger.error('Error fetching global decks', err);
    res.status(500).json({ error: 'Failed to fetch global decks' });
  }
});

// Get a single deck by id
router.get('/:id', async (req, res) => {
  try {
    const deckId = req.params.id
    console.log('🔍 Backend: Fetching deck with ID:', deckId)
    console.log('🔍 Backend: ID type and length:', typeof deckId, deckId?.length)
    
    const deck = await Deck.findById(deckId)
    console.log('🔍 Backend: Deck lookup result:', deck ? 'FOUND' : 'NOT_FOUND')
    
    if (!deck) {
      console.log('🔍 Backend: Deck not found, returning 404')
      return res.status(404).json({ error: 'Deck not found' })
    }
    
    console.log('🔍 Backend: Returning deck:', deck.deckName)
    res.json(deck)
  } catch (err) {
    logger.error('🔍 Backend: Error fetching deck', err)
    res.status(500).json({ error: 'Failed to fetch deck' })
  }
})

// Create a new deck (authenticated)
router.post('/', passport.authenticate('jwt', { session: false }), async (req, res) => {
  try {
    const { deckName, description, cards } = req.body
    if (!deckName) return res.status(400).json({ error: 'deckName is required' })
    
    const owner = req.user && (req.user.id || req.user._id) ? (req.user.id || req.user._id) : null
    
    if (!owner) {
      return res.status(401).json({ error: 'Authentication required to create deck' })
    }
    
    // Check for duplicate deckName for THIS user only (case-insensitive)
    const escapeReg = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const existing = await Deck.findOne({ 
      deckName: { $regex: `^${escapeReg(deckName)}$`, $options: 'i' },
      owner: owner 
    })
    
    if (existing) {
      return res.status(409).json({ error: 'You already have a deck with that name' })
    }

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

    const deckData = { deckName, description, cards: cardsToSave, owner }

    const deck = new Deck(deckData)
    await deck.save()
    
    // Initialize blob folder structure for this deck
    try {
      const folderStructure = await createDeckFolderStructure(deck._id.toString(), owner.toString())
      logger.info('Deck blob folder structure initialized:', folderStructure)
    } catch (folderErr) {
      logger.warn('Failed to initialize deck folder structure:', folderErr)
      // Don't fail the deck creation if folder structure fails
    }
    
    res.status(201).json({
      ...deck.toObject(),
      message: 'Deck created successfully. Upload images to populate the deck.'
    })
  } catch (err) {
    logger.error('Error creating deck', err)
    res.status(500).json({ error: 'Failed to create deck' })
  }
})

// Update deck name and description (protected)
router.patch('/:id', passport.authenticate('jwt', { session: false }), async (req, res) => {
  try {
    const { id } = req.params
    const { deckName, description } = req.body
    
    const deck = await Deck.findById(id)
    if (!deck) return res.status(404).json({ error: 'Deck not found' })

    // Check if this is the Rider-Waite deck - prevent editing
    if (deck.deckName === 'Rider-Waite Tarot Deck') {
      return res.status(403).json({ error: 'Rider-Waite Tarot deck cannot be edited' })
    }

    // If deck has an owner, only allow the owner to update
    if (deck.owner) {
      const ownerId = deck.owner.toString()
      const userId = req.user && (req.user.id || req.user._id) ? (req.user.id || req.user._id).toString() : null
      if (!userId || ownerId !== userId) {
        return res.status(403).json({ error: 'Not authorized to update this deck' })
      }
    }

    // Update fields if provided
    if (deckName !== undefined && deckName.trim()) {
      deck.deckName = deckName.trim()
    }
    if (description !== undefined) {
      deck.description = description
    }

    await deck.save()
    res.json({ success: true, deck })
  } catch (err) {
    console.error('Error updating deck', err)
    res.status(500).json({ error: 'Failed to update deck' })
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

