// Usage: node server/scripts/seed_spreads.js
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') })
const mongoose = require('mongoose')
const path = require('path')
const fs = require('fs')

const Spread = require('../models/Spread')

async function seedSpreads() {
  const spreadsPath = path.resolve(__dirname, '../../client/public/spreads.json')
  if (!fs.existsSync(spreadsPath)) {
    console.error('spreads.json not found at', spreadsPath)
    process.exit(1)
  }
  const raw = fs.readFileSync(spreadsPath, 'utf8')
  let items = []
  try {
    items = JSON.parse(raw)
  } catch (e) {
    console.error('Failed to parse spreads.json:', e)
    process.exit(1)
  }

  await mongoose.connect(process.env.MONGODB_URI)
  console.log('Connected to MongoDB')

  await Spread.deleteMany({})
  console.log('Cleared spreads collection')

  // Insert all spreads, including numberofCards if present
  const docs = items.map(it => ({
    spread: it.spread || '',
    cards: Array.isArray(it.cards) ? it.cards : [],
    image: it.image || '',
    numberofCards: it.numberofCards || (Array.isArray(it.cards) ? it.cards.length : undefined)
  }))
  await Spread.insertMany(docs)
  console.log(`Inserted ${docs.length} spreads`)

  await mongoose.disconnect()
  console.log('Done.')
}

seedSpreads().catch(e => {
  console.error(e)
  process.exit(1)
})
