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
  createdAt: { type: Date, default: Date.now }
})

module.exports = mongoose.model('Deck', deckSchema)
