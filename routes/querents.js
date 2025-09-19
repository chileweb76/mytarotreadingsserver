const express = require('express')
const router = express.Router()
const Querent = require('../models/Querent')
const passport = require('passport')

// Get querents for current user (authenticated) or all for anonymous
router.get('/', passport.authenticate('jwt', { session: false }), async (req, res) => {
  try {
    const querents = await Querent.find({ userId: req.user._id.toString() }).sort({ createdAt: -1 })
    res.json({ querents })
  } catch (err) {
    console.error('Get querents error:', err)
    res.status(500).json({ error: 'Failed to fetch querents' })
  }
})

// Create new querent (authenticated)
router.post('/', passport.authenticate('jwt', { session: false }), async (req, res) => {
  try {
    const { name } = req.body
    if (!name || typeof name !== 'string' || name.trim().length < 1) {
      return res.status(400).json({ error: 'Invalid name' })
    }
    const q = new Querent({ name: name.trim(), userId: req.user._id.toString() })
    await q.save()
    res.status(201).json({ querent: q })
  } catch (err) {
    console.error('Create querent error:', err)
    res.status(500).json({ error: 'Failed to create querent' })
  }
})

// Delete querent (permanent) - require name verification
router.delete('/:id', passport.authenticate('jwt', { session: false }), async (req, res) => {
  try {
    const { id } = req.params
    const { verifyName } = req.body
    if (!id) return res.status(400).json({ error: 'Querent id required' })

    const q = await Querent.findById(id)
    if (!q) return res.status(404).json({ error: 'Querent not found' })
    if (q.userId !== req.user._id.toString()) return res.status(403).json({ error: 'Not authorized' })

    if (!verifyName || verifyName.trim() !== q.name) return res.status(400).json({ error: 'Verification name does not match' })

    await Querent.findByIdAndDelete(id)
    return res.json({ message: 'Querent deleted' })
  } catch (err) {
    console.error('Delete querent error:', err)
    res.status(500).json({ error: 'Failed to delete querent' })
  }
})

module.exports = router
