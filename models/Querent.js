const mongoose = require('mongoose')

const querentSchema = new mongoose.Schema({
  name: { type: String, required: true },
  userId: { type: String, default: null }, // null for global querents like "Self"
  createdAt: { type: Date, default: Date.now }
})

// Allow same querent name for different users
querentSchema.index({ name: 1, userId: 1 }, { unique: true })

module.exports = mongoose.model('Querent', querentSchema)
