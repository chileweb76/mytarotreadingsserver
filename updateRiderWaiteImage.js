const mongoose = require('mongoose')
const path = require('path')
const fs = require('fs')
require('dotenv').config()

const Deck = require('./models/Deck')

async function updateRiderWaiteDeckImage() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI)
    console.log('✅ Connected to MongoDB')

    // Load rider_waite.json
    const riderWaitePath = path.join(__dirname, '..', 'rider_waite.json')
    if (!fs.existsSync(riderWaitePath)) {
      console.error('❌ rider_waite.json not found')
      process.exit(1)
    }

    const deckData = JSON.parse(fs.readFileSync(riderWaitePath, 'utf8'))

    // Find the existing Rider-Waite deck
    const existingDeck = await Deck.findOne({ deckName: 'Rider-Waite Tarot Deck' })
    
    if (!existingDeck) {
      console.log('❌ Rider-Waite deck not found in database')
      process.exit(1)
    }

    // Check if image field is missing or empty
    if (!existingDeck.image && deckData.image) {
      existingDeck.image = deckData.image
      await existingDeck.save()
      console.log('✅ Updated Rider-Waite deck with cover image:', deckData.image)
    } else if (existingDeck.image) {
      console.log('📚 Rider-Waite deck already has cover image:', existingDeck.image)
    } else {
      console.log('❌ No image specified in rider_waite.json')
    }

  } catch (error) {
    console.error('❌ Error updating Rider-Waite deck:', error)
  } finally {
    await mongoose.disconnect()
    console.log('👋 Disconnected from MongoDB')
  }
}

updateRiderWaiteDeckImage()