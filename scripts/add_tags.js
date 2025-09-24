#!/usr/bin/env node
/*
Idempotent script to add default public tags.
Usage:
  MONGODB_URI="..." node scripts/add_tags.js

It will skip tags that already exist (by `nameLower` + owner:null).
*/

const path = require('path')
const fs = require('fs')

// load .env if present in project root
const dotenvPath = path.resolve(__dirname, '..', '.env')
if (fs.existsSync(dotenvPath)) require('dotenv').config({ path: dotenvPath })

const { connectToDatabase } = require('../utils/connectToDatabase')
const mongoose = require('mongoose')

const Tag = require('../models/Tag')

const DEFAULT_TAGS = ['Love', 'Career', 'Family', 'Health', 'Relationship']

async function run() {
  if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI not set in environment. Run like:')
    console.error('  MONGODB_URI="mongodb://..." node scripts/add_tags.js')
    process.exit(2)
  }

  await connectToDatabase()
  console.log('Connected to DB')

  const created = []
  const updated = []

  for (const name of DEFAULT_TAGS) {
    const nameClean = name.trim()
    const nameLower = nameClean.toLowerCase()

    try {
      // Ensure there's a single global tag (userId: null) for this nameLower.
      // Use upsert to create if missing; also ensure existing docs are marked global.
      const res = await Tag.findOneAndUpdate(
        { nameLower, userId: null },
        {
          $set: { name: nameClean, isGlobal: true, userId: null },
          $setOnInsert: { nameLower }
        },
        { upsert: true, new: true }
      ).exec()

      // If the document existed but previously wasn't global, we may need to
      // update any duplicate non-global documents (same nameLower but with a userId).
      // Convert them to global only if they are empty/placeholder; otherwise skip.
      // For safety, we will not alter other users' tags; instead we ensure the
      // global tag exists and mark it as created/updated accordingly.

      // Determine whether this was an insert (created) by checking the createdAt
      // vs updatedAt timestamps (not perfect) or by attempting to detect upsert
      // result. Mongoose doesn't expose upserted flag via findOneAndUpdate easily,
      // so check whether the doc's createdAt equals updatedAt (newly created).
      if (res) {
        if (res.createdAt && res.updatedAt && +res.createdAt === +res.updatedAt) {
          created.push(nameClean)
          console.log('Created global tag:', nameClean)
        } else {
          updated.push(nameClean)
          console.log('Ensured global tag:', nameClean)
        }
      }
    } catch (err) {
      console.error('Failed to ensure tag', nameClean, err && err.message)
    }
  }

  console.log('Summary: created=%d ensured=%d', created.length, updated.length)
  await mongoose.disconnect()
  process.exit(0)
}

run().catch(err => {
  console.error('Error running add_tags:', err && err.message)
  process.exit(1)
})
