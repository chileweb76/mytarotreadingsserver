#!/usr/bin/env node
// seed_rider_from_frontend.js
// Reads ../mytarotreadings/rider_waite.json and upserts it as a global deck (owner: null)
// Uses MONGODB_URI from server .env (or env var). Creates a backup if a deck with the same name exists.

const path = require('path')
const fs = require('fs').promises

// Load server .env (if present)
try { require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') }) } catch (e) {}

async function main() {
  // frontend repo is a sibling folder to the server repo
  const riderPath = path.resolve(__dirname, '..', '..', 'mytarotreadings', 'rider_waite.json')
  console.log('Reading rider file at', riderPath)
  let raw
  try {
    raw = await fs.readFile(riderPath, 'utf8')
  } catch (err) {
    console.error('Failed to read rider_waite.json:', err.message)
    process.exit(1)
  }

  let deckData
  try {
    deckData = JSON.parse(raw)
  } catch (err) {
    console.error('Failed to parse rider_waite.json:', err.message)
    process.exit(1)
  }

  if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI not found in environment or server .env. Please set it.')
    process.exit(1)
  }

  // Connect to DB using existing helper if available
  const { connectToDatabase } = require('../utils/connectToDatabase')
  await connectToDatabase()
  console.log('Connected to DB')

  const Deck = require('../models/Deck')

  // Backup existing deck if present
  const existing = await Deck.findOne({ deckName: deckData.deckName }).lean()
  if (existing) {
    const backupsDir = path.resolve(__dirname, '..', 'backups')
    await fs.mkdir(backupsDir, { recursive: true })
    const ts = new Date().toISOString().replace(/[:.]/g, '-')
    const backupPath = path.join(backupsDir, `deck-backup-${existing._id}-${ts}.json`)
    await fs.writeFile(backupPath, JSON.stringify(existing, null, 2), 'utf8')
    console.log('Backed up existing deck to', backupPath)
  }

  // Prepare cards array to match server model
  const cards = Array.isArray(deckData.cards) ? deckData.cards.map(c => ({ name: c.name || c, image: c.image || '' })) : []

  const payload = {
    deckName: deckData.deckName,
    description: deckData.description || '',
    image: deckData.image || '',
    owner: null,
    cards,
    isGlobal: true,
    updatedAt: new Date()
  }

  const res = await Deck.findOneAndUpdate(
    { deckName: deckData.deckName },
    { $set: payload },
    { upsert: true, new: true }
  )

  console.log('Upsert completed. Deck id:', res._id.toString())
  console.log('Cards count:', res.cards.length)
  process.exit(0)
}

main().catch(err => {
  console.error('Seeding failed:', err)
  process.exit(1)
})
