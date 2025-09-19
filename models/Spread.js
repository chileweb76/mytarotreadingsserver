const mongoose = require('mongoose')


const spreadSchema = new mongoose.Schema({
  spread: { type: String, required: true },
  cards: { type: [String], default: [] },
  image: { type: String, default: '/images/spreads/custom.png' },
  numberofCards: { type: Number },
  meanings: { type: [String], default: [] },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false },
  isCustom: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
})

module.exports = mongoose.model('Spread', spreadSchema)
