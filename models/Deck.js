const mongoose = require('mongoose')

const cardSchema = new mongoose.Schema({
  name: { type: String, required: true },
  image: { type: String, required: false } // path or URL to card image
})

const deckSchema = new mongoose.Schema({
  deckName: { type: String, required: true },
  description: { type: String, required: false },
  image: { type: String, required: false }, // path or URL to deck cover image
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false },
  cards: [cardSchema],
  isGlobal: { type: Boolean, default: false }, // Global decks available to all users
  createdAt: { type: Date, default: Date.now }
})

// Add compound unique index to allow same deckName for different users
// but prevent duplicate deckNames for the same user
deckSchema.index({ deckName: 1, owner: 1 }, { unique: true })

module.exports = mongoose.model('Deck', deckSchema)
