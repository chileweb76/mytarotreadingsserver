#!/usr/bin/env node
// Debug helper: dump spreads from MongoDB to verify cards/numberofCards
const path = require('path')
const fs = require('fs')

try { require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') }) } catch (e) {}

async function main() {
  const uri = process.env.MONGODB_URI
  if (!uri) {
    console.error('MONGODB_URI not set in server .env or environment')
    process.exit(1)
  }

  const { connectToDatabase } = require('../utils/connectToDatabase')
  await connectToDatabase()
  const Spread = require('../models/Spread')

  const spreads = await Spread.find({}).sort({ numberofCards: 1 }).lean()
  console.log(`Found ${spreads.length} spreads`)
  spreads.slice(0, 50).forEach((s, i) => {
    const id = s._id || s.id
    const name = s.spread || s.title || ''
    const cardsCount = Array.isArray(s.cards) ? s.cards.length : 0
    console.log(`${i+1}. id=${id} name='${name}' numberofCards=${s.numberofCards} cards.length=${cardsCount}`)
    if (cardsCount > 0) {
      console.log('   sample cards:', JSON.stringify(s.cards.slice(0,10)))
    }
  })

  process.exit(0)
}

main().catch(err => {
  console.error('Failed to dump spreads', err)
  process.exit(1)
})
