#!/usr/bin/env node
/**
 * Migration script to normalize Tag documents:
 * - populate `nameLower` from `name`
 * - convert string `userId` values to ObjectId or null
 * - ensure unique index { nameLower: 1, userId: 1 }
 *
 * Usage:
 *   MONGODB_URI="<uri>" node scripts/migrate_tags.js
 */

const mongoose = require('mongoose')
const path = require('path')

async function run() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URL
  if (!uri) {
    console.error('Please set MONGODB_URI in environment')
    process.exit(1)
  }

  // Ensure models path resolution works
  const serverRoot = path.resolve(__dirname, '..')
  require('module').Module._initPaths()

  // Use the Tag model from the server code
  const Tag = require(path.join(serverRoot, 'models', 'Tag'))

  await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true })
  console.log('Connected to MongoDB')

  try {
    const tags = await Tag.find({}).exec()
    console.log(`Found ${tags.length} tag(s)`)

    for (const t of tags) {
      let changed = false
      if (t.name && (!t.nameLower || t.nameLower !== t.name.trim().toLowerCase())) {
        t.nameLower = t.name.trim().toLowerCase()
        changed = true
      }

      // convert string userId to ObjectId where appropriate, else null
      if (t.userId && typeof t.userId === 'string') {
        const s = t.userId.trim()
        if (/^[0-9a-fA-F]{24}$/.test(s)) {
          t.userId = mongoose.Types.ObjectId(s)
          changed = true
        } else if (s === '') {
          t.userId = null
          changed = true
        }
      }

      if (changed) {
        try {
          await t.save()
          console.log(`Updated tag ${t._id}`)
        } catch (err) {
          console.error(`Failed to update tag ${t._id}:`, err.message)
        }
      }
    }

    // Ensure indexes are created
    await Tag.init()
    console.log('Indexes ensured (Tag.init completed)')
  } finally {
    await mongoose.disconnect()
    console.log('Disconnected')
  }
}

run().catch(err => {
  console.error('Migration failed:', err)
  process.exit(1)
})
