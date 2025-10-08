const express = require('express')
const router = express.Router()
const Tag = require('../models/Tag')
const passport = require('passport')
const mongoose = require('mongoose')
const logger = require('../lib/logger')

// GET /api/tags - Get all tags (global + user's custom tags)
router.get('/', async (req, res) => {
  try {
    const userId = req.user?.id || req.headers['x-user-id']

    // Build query: always include global tags, and include user's tags when we have a user
    let parsedUserId = null
    try {
      if (userId && mongoose && mongoose.Types && typeof mongoose.Types.ObjectId === 'function' && mongoose.Types.ObjectId.isValid && mongoose.Types.ObjectId.isValid(userId)) {
        // Use `new` to construct an ObjectId instance where supported
        try {
          parsedUserId = new mongoose.Types.ObjectId(userId)
        } catch (e) {
          // Fallback: use the raw value if construction fails
          parsedUserId = userId
        }
      } else {
        parsedUserId = userId
      }
    } catch (e) {
      parsedUserId = userId
    }

    const query = parsedUserId
      ? { $or: [ { isGlobal: true, userId: null }, { userId: parsedUserId } ] }
      : { isGlobal: true, userId: null }

    const tags = await Tag.find(query).sort({ isGlobal: -1, nameLower: 1 }) // Global first, then alphabetical

    return res.json({ ok: true, tags })
  } catch (err) {
    logger.error('Get tags error:', err)
    res.status(500).json({ ok: false, error: 'Failed to fetch tags' })
  }
})

// POST /api/tags - Create new user tag (authenticated)
router.post('/', passport.authenticate('jwt', { session: false }), async (req, res) => {
  try {
    const { name } = req.body || {}
    if (!name || typeof name !== 'string' || name.trim().length < 1) {
      return res.status(400).json({ ok: false, error: 'Invalid tag name' })
    }

    const normalized = name.trim()
    const userId = req.user._id

    // Prevent creating a personal tag that collides with an existing global tag
    const existingGlobal = await Tag.findOne({ nameLower: normalized.toLowerCase(), isGlobal: true }).exec()
    if (existingGlobal) return res.status(400).json({ ok: false, error: 'A global tag with this name already exists' })

    // Use upsert to avoid races: if the tag already exists for this user, return it; otherwise create.
    const filter = { nameLower: normalized.toLowerCase(), userId }
    const update = { $setOnInsert: { name: normalized, userId, isGlobal: false } }
    const options = { upsert: true, new: true, setDefaultsOnInsert: true }

    let tag
    try {
      tag = await Tag.findOneAndUpdate(filter, update, options).exec()
    } catch (err) {
      // handle race duplicate key error by returning the existing doc
      if (err && err.code === 11000) {
        tag = await Tag.findOne(filter).exec()
        if (tag) return res.status(200).json({ ok: true, tag })
        return res.status(409).json({ ok: false, error: 'Tag already exists' })
      }
      throw err
    }

    return res.status(201).json({ ok: true, tag })
  } catch (err) {
    logger.error('Create tag error:', err)
    return res.status(500).json({ ok: false, error: 'Failed to create tag' })
  }
})

// DELETE /api/tags/:id - Delete user tag (authenticated, only user's own tags)
router.delete('/:id', passport.authenticate('jwt', { session: false }), async (req, res) => {
  try {
    const { id } = req.params
    const userId = req.user._id

    if (!id) return res.status(400).json({ ok: false, error: 'Tag id required' })
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ ok: false, error: 'Invalid tag id' })

    const tag = await Tag.findById(id).exec()
    if (!tag) return res.status(404).json({ ok: false, error: 'Tag not found' })

    // Prevent deletion of global tags
    if (tag.isGlobal) return res.status(403).json({ ok: false, error: 'Cannot delete global tags' })

    // Ensure user can only delete their own tags
    if (!tag.userId || tag.userId.toString() !== userId.toString()) {
      return res.status(403).json({ ok: false, error: 'Not authorized to delete this tag' })
    }

    await Tag.findByIdAndDelete(id).exec()
    return res.json({ ok: true, message: 'Tag deleted successfully' })
  } catch (err) {
    console.error('Delete tag error:', err)
    return res.status(500).json({ ok: false, error: 'Failed to delete tag' })
  }
})

module.exports = router