const express = require('express')
const router = express.Router()
const Tag = require('../models/Tag')
const passport = require('passport')

// GET /api/tags - Get all tags (global + user's custom tags)
router.get('/', async (req, res) => {
  try {
    const userId = req.user?.id || req.headers['x-user-id']
    
    // Get global tags and user's custom tags
    const query = {
      $or: [
        { isGlobal: true, userId: null }, // Global tags
        { userId: userId || null } // User's custom tags (if authenticated)
      ]
    }
    
    const tags = await Tag.find(query).sort({ isGlobal: -1, name: 1 }) // Global first, then alphabetical
    
    res.json({ tags })
  } catch (err) {
    console.error('Get tags error:', err)
    res.status(500).json({ error: 'Failed to fetch tags' })
  }
})

// POST /api/tags - Create new user tag (authenticated)
router.post('/', passport.authenticate('jwt', { session: false }), async (req, res) => {
  try {
    const { name } = req.body
    if (!name || typeof name !== 'string' || name.trim().length < 1) {
      return res.status(400).json({ error: 'Invalid tag name' })
    }
    
    const tagName = name.trim()
    const userId = req.user._id.toString()
    
    // Check if tag already exists for this user
    const existingTag = await Tag.findOne({ name: tagName, userId })
    if (existingTag) {
      return res.status(400).json({ error: 'Tag already exists' })
    }
    
    // Check if global tag with same name exists
    const globalTag = await Tag.findOne({ name: tagName, isGlobal: true })
    if (globalTag) {
      return res.status(400).json({ error: 'A global tag with this name already exists' })
    }
    
    const tag = new Tag({ 
      name: tagName, 
      userId: userId,
      isGlobal: false 
    })
    await tag.save()
    
    res.status(201).json({ tag })
  } catch (err) {
    console.error('Create tag error:', err)
    res.status(500).json({ error: 'Failed to create tag' })
  }
})

// DELETE /api/tags/:id - Delete user tag (authenticated, only user's own tags)
router.delete('/:id', passport.authenticate('jwt', { session: false }), async (req, res) => {
  try {
    const { id } = req.params
    const userId = req.user._id.toString()
    
    if (!id) return res.status(400).json({ error: 'Tag id required' })

    const tag = await Tag.findById(id)
    if (!tag) return res.status(404).json({ error: 'Tag not found' })
    
    // Prevent deletion of global tags
    if (tag.isGlobal) {
      return res.status(403).json({ error: 'Cannot delete global tags' })
    }
    
    // Ensure user can only delete their own tags
    if (tag.userId !== userId) {
      return res.status(403).json({ error: 'Not authorized to delete this tag' })
    }

    await Tag.findByIdAndDelete(id)
    return res.json({ message: 'Tag deleted successfully' })
  } catch (err) {
    console.error('Delete tag error:', err)
    res.status(500).json({ error: 'Failed to delete tag' })
  }
})

module.exports = router