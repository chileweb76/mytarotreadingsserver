#!/usr/bin/env node
/**
 * seed_spreads_from_frontend.js
 * Seeds the Spreads collection from the frontend public/spreads.json file.
 * Behavior:
 *  - Reads ../mytarotreadings/public/spreads.json
 *  - Removes existing default spreads (owner: null)
 *  - Inserts spreads from the file with owner: null and isCustom: false
 *
 * Usage:
 *   node scripts/seed_spreads_from_frontend.js
 *
 * Requires MONGODB_URI in server .env or environment.
 */

const path = require('path')
const fs = require('fs').promises

// Load server .env if present
try { require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') }) } catch (e) {}

async function main() {
  const spreadsPath = path.resolve(__dirname, '..', '..', 'mytarotreadings', 'public', 'spreads.json')
  console.log('Reading spreads file at', spreadsPath)

  let raw
  try {
    raw = await fs.readFile(spreadsPath, 'utf8')
  } catch (err) {
    console.error('Failed to read spreads.json:', err.message)
    process.exit(1)
  }

  let spreadsData
  try {
    spreadsData = JSON.parse(raw)
  } catch (err) {
    console.error('Failed to parse spreads.json:', err.message)
    process.exit(1)
  }

  if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI not found in environment or server .env. Please set it.')
    process.exit(1)
  }

  const { connectToDatabase } = require('../utils/connectToDatabase')
  await connectToDatabase()
  console.log('Connected to DB')

  const Spread = require('../models/Spread')

  console.log('Clearing existing default spreads (owner: null)...')
  const del = await Spread.deleteMany({ owner: null })
  console.log(`Deleted ${del.deletedCount} default spreads`) 

  const DEFAULT_CUSTOM_SPREAD_IMAGE = 'https://emfobsnlxploca6s.public.blob.vercel-storage.com/spreads/custom.png'

  const docs = spreadsData.map(s => ({
    spread: s.spread,
    cards: s.cards || [],
    image: s.image || DEFAULT_CUSTOM_SPREAD_IMAGE,
    numberofCards: s.numberofCards || (s.cards ? s.cards.length : 0),
    owner: null,
    isCustom: false,
    createdAt: new Date()
  }))

  console.log('Inserting spreads...')
  const res = await Spread.insertMany(docs)
  console.log(`Inserted ${res.length} spreads`)
  res.forEach((r, i) => console.log(`${i+1}. ${r.spread} (${r.numberofCards} cards) id=${r._id}`))

  process.exit(0)
}

main().catch(err => {
  console.error('Seeding failed:', err)
  process.exit(1)
})
