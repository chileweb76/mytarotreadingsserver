const mongoose = require('mongoose')

const tagSchema = new mongoose.Schema({
  name: { type: String, required: true },
  userId: { type: String, default: null }, // null for global tags, userId for user-created tags
  isGlobal: { type: Boolean, default: false }, // true for global predefined tags
  createdAt: { type: Date, default: Date.now }
})

// Ensure no duplicate tags for the same user (or globally)
tagSchema.index({ name: 1, userId: 1 }, { unique: true })

module.exports = mongoose.model('Tag', tagSchema)