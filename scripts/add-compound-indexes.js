#!/usr/bin/env node

/**
 * Migration script to add compound unique indexes to existing collections
 * Run this once after deploying the model changes to ensure indexes are created
 * 
 * Usage: node scripts/add-compound-indexes.js
 */

const mongoose = require('mongoose')
const { connectToDatabase } = require('../utils/connectToDatabase')

async function addCompoundIndexes() {
  try {
    console.log('🔄 Connecting to MongoDB...')
    await connectToDatabase()
    console.log('✅ Connected to MongoDB')

    const db = mongoose.connection.db

    // Add compound index for Decks: deckName + owner
    console.log('\n📦 Adding compound index for Decks collection...')
    const decksCollection = db.collection('decks')
    
    // Check if index already exists
    const deckIndexes = await decksCollection.indexes()
    const deckIndexExists = deckIndexes.some(idx => 
      idx.name === 'deckName_1_owner_1' || 
      (idx.key && idx.key.deckName === 1 && idx.key.owner === 1)
    )
    
    if (deckIndexExists) {
      console.log('⏭️  Deck compound index already exists, skipping...')
    } else {
      await decksCollection.createIndex(
        { deckName: 1, owner: 1 }, 
        { unique: true, name: 'deckName_1_owner_1' }
      )
      console.log('✅ Deck compound index created: deckName + owner')
    }

    // Add compound index for Querents: name + userId
    console.log('\n👤 Adding compound index for Querents collection...')
    const querentsCollection = db.collection('querents')
    
    const querentIndexes = await querentsCollection.indexes()
    const querentIndexExists = querentIndexes.some(idx => 
      idx.name === 'name_1_userId_1' ||
      (idx.key && idx.key.name === 1 && idx.key.userId === 1)
    )
    
    if (querentIndexExists) {
      console.log('⏭️  Querent compound index already exists, skipping...')
    } else {
      await querentsCollection.createIndex(
        { name: 1, userId: 1 }, 
        { unique: true, name: 'name_1_userId_1' }
      )
      console.log('✅ Querent compound index created: name + userId')
    }

    // Add compound index for Spreads: spread + owner
    console.log('\n🃏 Adding compound index for Spreads collection...')
    const spreadsCollection = db.collection('spreads')
    
    const spreadIndexes = await spreadsCollection.indexes()
    const spreadIndexExists = spreadIndexes.some(idx => 
      idx.name === 'spread_1_owner_1' ||
      (idx.key && idx.key.spread === 1 && idx.key.owner === 1)
    )
    
    if (spreadIndexExists) {
      console.log('⏭️  Spread compound index already exists, skipping...')
    } else {
      await spreadsCollection.createIndex(
        { spread: 1, owner: 1 }, 
        { unique: true, name: 'spread_1_owner_1' }
      )
      console.log('✅ Spread compound index created: spread + owner')
    }

    console.log('\n✅ All compound indexes have been created successfully!')
    console.log('\n📊 Index Summary:')
    console.log('  - Decks: deckName + owner (allows same deck name per user)')
    console.log('  - Querents: name + userId (allows same querent name per user)')
    console.log('  - Spreads: spread + owner (allows same spread name per user)')
    console.log('\n🎉 Migration complete!')

  } catch (error) {
    console.error('❌ Error adding compound indexes:', error)
    process.exit(1)
  } finally {
    await mongoose.connection.close()
    console.log('\n🔌 MongoDB connection closed')
    process.exit(0)
  }
}

// Run the migration
addCompoundIndexes()
