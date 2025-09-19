// Usage: node server/scripts/migrate_add_numberofcards.js
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') })
const mongoose = require('mongoose')
const Spread = require('../models/Spread')

async function migrate() {
  if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI not set in environment')
    process.exit(1)
  }

  await mongoose.connect(process.env.MONGODB_URI)
  console.log('Connected to MongoDB')

  const spreads = await Spread.find({})
  console.log(`Found ${spreads.length} spreads`)

  let updated = 0
  for (const s of spreads) {
    if (s.numberofCards === undefined || s.numberofCards === null) {
      const n = Array.isArray(s.cards) ? s.cards.length : 0
      s.numberofCards = n
      await s.save()
      updated++
      console.log(`Updated spread '${s.spread}' -> numberofCards=${n}`)
    }
  }

  console.log(`Migration complete. Documents updated: ${updated}`)
  await mongoose.disconnect()
}

migrate().catch(err => {
  console.error('Migration failed', err)
  process.exit(1)
})
