const express = require('express')
const router = express.Router()
const Spread = require('../models/Spread')
const passport = require('passport')

// Create a new spread (public for now; can be protected later)
router.post('/', passport.authenticate('jwt', { session: false }), async (req, res) => {
  try {
    const { spread, cards, image, numberofCards, meanings } = req.body
    if (!spread) return res.status(400).json({ error: 'spread is required' })
    const doc = new Spread({
      spread,
      cards: Array.isArray(cards) ? cards : [],
  image: image && String(image).trim() ? image : '/images/spreads/custom.png',
      numberofCards: numberofCards || (Array.isArray(cards) ? cards.length : undefined),
      meanings: Array.isArray(meanings) ? meanings : [],
      owner: req.user && (req.user._id || req.user.id) ? (req.user._id || req.user.id) : null,
      isCustom: true
    })
    await doc.save()
    res.status(201).json(doc)
  } catch (err) {
    console.error('Error creating spread', err)
    res.status(500).json({ error: 'Failed to create spread' })
  }
})

// Get all spreads
router.get('/', async (req, res) => {
  try {
    const spreads = await Spread.find({}).sort({ spread: 1 })
    res.json(spreads)
  } catch (err) {
    console.error('Error fetching spreads', err)
    res.status(500).json({ error: 'Failed to fetch spreads' })
  }
})

// Get spread by id
router.get('/:id', async (req, res) => {
  try {
    const spread = await Spread.findById(req.params.id)
    if (!spread) return res.status(404).json({ error: 'Spread not found' })
    res.json(spread)
  } catch (err) {
    console.error('Error fetching spread', err)
    res.status(500).json({ error: 'Failed to fetch spread' })
  }
})

// Get spread by name (query param ?name=... )
router.get('/by-name', async (req, res) => {
  try {
    const name = req.query.name || ''
    if (!name) return res.status(400).json({ error: 'name query param is required' })
    const spread = await Spread.findOne({ spread: { $regex: `^${name}$`, $options: 'i' } })
    if (!spread) return res.status(404).json({ error: 'Spread not found' })
    res.json(spread)
  } catch (err) {
    console.error('Error fetching spread by name', err)
    res.status(500).json({ error: 'Failed to fetch spread' })
  }
})

// Delete a spread (owner or admin only)
router.delete('/:id', passport.authenticate('jwt', { session: false }), async (req, res) => {
  try {
    const id = req.params.id
    const spread = await Spread.findById(id)
    if (!spread) return res.status(404).json({ error: 'Spread not found' })

    const user = req.user
    const userId = user && (user._id || user.id) ? String(user._id || user.id) : null

    // If spread has an owner, only owner or admin can delete
    if (spread.owner) {
      if (!userId) return res.status(403).json({ error: 'Not authorized' })
      if (String(spread.owner) !== userId && !user.isAdmin) return res.status(403).json({ error: 'Not authorized' })
    } else {
      // No owner (built-in spread) - only admin can delete
      if (!user.isAdmin) return res.status(403).json({ error: 'Not authorized' })
    }

    await Spread.findByIdAndDelete(id)
    res.json({ success: true })
  } catch (err) {
    console.error('Error deleting spread', err)
    res.status(500).json({ error: 'Failed to delete spread' })
  }
})

module.exports = router
