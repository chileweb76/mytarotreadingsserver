const mongoose = require('mongoose')

const querentSchema = new mongoose.Schema({
  name: { type: String, required: true },
  userId: { type: String, default: null }, // null for global querents like "Self"
  createdAt: { type: Date, default: Date.now }
})

module.exports = mongoose.model('Querent', querentSchema)
