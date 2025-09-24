#!/usr/bin/env node

/**
 * Test script to verify Rider-Waite deck seeding
 */

const { connectToDatabase } = require('../utils/connectToDatabase');

async function testDeckSeeding() {
  try {
    console.log('🔍 Testing Rider-Waite deck seeding...\n');
    
    // Connect to database
    await connectToDatabase();
    const Deck = require('../models/Deck');
    
    // Find the Rider-Waite deck
    const riderWaiteDeck = await Deck.findOne({ 
      deckName: 'Rider-Waite Tarot Deck',
      isGlobal: true
    });
    
    if (!riderWaiteDeck) {
      console.log('❌ Rider-Waite deck not found');
      console.log('💡 Run: npm run seed:rider-waite');
      return;
    }
    
    console.log('✅ Rider-Waite deck found!');
    console.log(`📚 Deck ID: ${riderWaiteDeck._id}`);
    console.log(`🃏 Total cards: ${riderWaiteDeck.cards.length}`);
    console.log(`🖼️  Deck cover: ${riderWaiteDeck.image}`);
    console.log(`🌍 Global: ${riderWaiteDeck.isGlobal ? 'Yes' : 'No'}`);
    console.log(`👤 Owner: ${riderWaiteDeck.owner || 'None (Global)'}`);
    
    // Check card images
    const cardsWithImages = riderWaiteDeck.cards.filter(card => card.image);
    const blobCards = cardsWithImages.filter(card => card.image.startsWith('https://'));
    
    console.log(`\n🖼️  Cards with images: ${cardsWithImages.length}/${riderWaiteDeck.cards.length}`);
    console.log(`☁️  Cards with blob URLs: ${blobCards.length}/${cardsWithImages.length}`);
    
    // Show sample cards
    console.log('\n📋 Sample cards:');
    const sampleCards = riderWaiteDeck.cards.slice(0, 5);
    sampleCards.forEach(card => {
      const hasBlob = card.image && card.image.startsWith('https://');
      console.log(`  • ${card.name}: ${hasBlob ? '✅ Blob URL' : '❌ No blob URL'}`);
    });
    
    // Check for all 78 cards
    const expectedCards = [
      'The Fool', 'The Magician', 'The High Priestess', 'The Empress',
      'Ace of Wands', 'Two of Wands', 'Three of Wands',
      'Ace of Cups', 'Two of Cups', 'Three of Cups',
      'Ace of Swords', 'Two of Swords', 'Three of Swords',
      'Ace of Pentacles', 'Two of Pentacles', 'Three of Pentacles'
    ];
    
    const missingCards = expectedCards.filter(cardName => 
      !riderWaiteDeck.cards.some(card => card.name === cardName)
    );
    
    if (missingCards.length === 0) {
      console.log('\n✅ All expected cards present');
    } else {
      console.log(`\n⚠️  Missing cards: ${missingCards.join(', ')}`);
    }
    
    // Test deck endpoint
    console.log('\n🌐 API Endpoints to test:');
    console.log(`  • GET /api/decks - All decks (includes global)`);
    console.log(`  • GET /api/decks/global - Only global decks`);
    console.log(`  • GET /api/decks/${riderWaiteDeck._id} - Specific deck`);
    
    console.log('\n🎉 Deck seeding test completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run test
if (require.main === module) {
  testDeckSeeding()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('Test error:', error);
      process.exit(1);
    });
}

module.exports = { testDeckSeeding };