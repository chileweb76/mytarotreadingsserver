#!/usr/bin/env node
/**
 * backfill_reading_by.js
 * Populate the `by` field on existing Reading documents using the User referenced by userId.
 * Usage:
 *   node scripts/backfill_reading_by.js
 */

const path = require('path')
const mongoose = require('mongoose')
try { require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') }) } catch (e) {}

if (!process.env.MONGODB_URI) {
  console.error('MONGODB_URI not set in environment')
  process.exit(1)
}

async function main() {
  const { connectToDatabase } = require('../utils/connectToDatabase')
  await connectToDatabase()
  console.log('Connected to DB')

  const Reading = require('../models/Reading')
  const User = require('../models/User')

  const cursor = Reading.find({ $or: [ { by: { $exists: false } }, { by: null }, { by: '' } ] }).cursor()
  let count = 0
  for (let doc = await cursor.next(); doc != null; doc = await cursor.next()) {
    try {
      if (doc.userId) {
        const user = await User.findById(doc.userId)
        if (user) {
          doc.by = user.username || user.name || user.email || 'Unknown'
        } else {
          doc.by = 'Unknown'
        }
      } else {
        doc.by = 'Guest'
      }
      await doc.save()
      count++
      if (count % 50 === 0) console.log(`Updated ${count} readings...`)
    } catch (e) {
      console.error('Failed to update reading', doc._id, e)
    }
  }

  console.log(`Backfill complete. Updated ${count} readings.`)
  process.exit(0)
}

main().catch(err => {
  console.error('Backfill failed', err)
  process.exit(1)
})
