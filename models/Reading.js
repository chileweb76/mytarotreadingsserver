const mongoose = require('mongoose')

const drawnCardSchema = new mongoose.Schema({
  title: { type: String, required: true },
  suit: { type: String, required: false },
  card: { type: String, required: true }, 
  reversed: { type: Boolean, default: false },
  interpretation: { type: String, default: '' }
  ,
  image: { type: String, required: false }
})

const readingSchema = new mongoose.Schema({
  querent: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Querent',
    required: false 
  },
  spread: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Spread',
    required: false 
  },
  image: { type: String, required: false }, // reading image path/URL
  question: { type: String, required: false },
  deck: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Deck',
    required: false 
  },
  dateTime: { type: Date, required: true },
  drawnCards: [drawnCardSchema],
  interpretation: { type: String, default: '' }, // overall reading interpretation
  outcome: { type: String, default: '' }, // outcome of the reading
  selectedTags: [{ 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Tag' 
  }], // tags associated with this reading
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User',
    required: false 
  },
  createdAt: { type: Date, default: Date.now }
})

module.exports = mongoose.model('Reading', readingSchema)