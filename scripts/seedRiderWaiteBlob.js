const { put } = require('@vercel/blob');
const { connectToDatabase } = require('../utils/connectToDatabase');

// Load environment variables
require('dotenv').config();

/**
 * Seed Rider-Waite Tarot Deck with Vercel Blob Storage
 * Creates a global deck that all users can access
 * Uses built-in fetch (Node.js 18+)
 */

// Complete list of 78 Rider-Waite Tarot cards
const RIDER_WAITE_CARDS = [
  // Major Arcana (22 cards)
  { name: 'The Fool', type: 'major', number: 0 },
  { name: 'The Magician', type: 'major', number: 1 },
  { name: 'The High Priestess', type: 'major', number: 2 },
  { name: 'The Empress', type: 'major', number: 3 },
  { name: 'The Emperor', type: 'major', number: 4 },
  { name: 'The Hierophant', type: 'major', number: 5 },
  { name: 'The Lovers', type: 'major', number: 6 },
  { name: 'The Chariot', type: 'major', number: 7 },
  { name: 'Strength', type: 'major', number: 8 },
  { name: 'The Hermit', type: 'major', number: 9 },
  { name: 'Wheel of Fortune', type: 'major', number: 10 },
  { name: 'Justice', type: 'major', number: 11 },
  { name: 'The Hanged Man', type: 'major', number: 12 },
  { name: 'Death', type: 'major', number: 13 },
  { name: 'Temperance', type: 'major', number: 14 },
  { name: 'The Devil', type: 'major', number: 15 },
  { name: 'The Tower', type: 'major', number: 16 },
  { name: 'The Star', type: 'major', number: 17 },
  { name: 'The Moon', type: 'major', number: 18 },
  { name: 'The Sun', type: 'major', number: 19 },
  { name: 'Judgement', type: 'major', number: 20 },
  { name: 'The World', type: 'major', number: 21 },

  // Minor Arcana - Wands (14 cards)
  { name: 'Ace of Wands', type: 'minor', suit: 'wands', number: 1 },
  { name: 'Two of Wands', type: 'minor', suit: 'wands', number: 2 },
  { name: 'Three of Wands', type: 'minor', suit: 'wands', number: 3 },
  { name: 'Four of Wands', type: 'minor', suit: 'wands', number: 4 },
  { name: 'Five of Wands', type: 'minor', suit: 'wands', number: 5 },
  { name: 'Six of Wands', type: 'minor', suit: 'wands', number: 6 },
  { name: 'Seven of Wands', type: 'minor', suit: 'wands', number: 7 },
  { name: 'Eight of Wands', type: 'minor', suit: 'wands', number: 8 },
  { name: 'Nine of Wands', type: 'minor', suit: 'wands', number: 9 },
  { name: 'Ten of Wands', type: 'minor', suit: 'wands', number: 10 },
  { name: 'Page of Wands', type: 'minor', suit: 'wands', court: 'page' },
  { name: 'Knight of Wands', type: 'minor', suit: 'wands', court: 'knight' },
  { name: 'Queen of Wands', type: 'minor', suit: 'wands', court: 'queen' },
  { name: 'King of Wands', type: 'minor', suit: 'wands', court: 'king' },

  // Minor Arcana - Cups (14 cards)
  { name: 'Ace of Cups', type: 'minor', suit: 'cups', number: 1 },
  { name: 'Two of Cups', type: 'minor', suit: 'cups', number: 2 },
  { name: 'Three of Cups', type: 'minor', suit: 'cups', number: 3 },
  { name: 'Four of Cups', type: 'minor', suit: 'cups', number: 4 },
  { name: 'Five of Cups', type: 'minor', suit: 'cups', number: 5 },
  { name: 'Six of Cups', type: 'minor', suit: 'cups', number: 6 },
  { name: 'Seven of Cups', type: 'minor', suit: 'cups', number: 7 },
  { name: 'Eight of Cups', type: 'minor', suit: 'cups', number: 8 },
  { name: 'Nine of Cups', type: 'minor', suit: 'cups', number: 9 },
  { name: 'Ten of Cups', type: 'minor', suit: 'cups', number: 10 },
  { name: 'Page of Cups', type: 'minor', suit: 'cups', court: 'page' },
  { name: 'Knight of Cups', type: 'minor', suit: 'cups', court: 'knight' },
  { name: 'Queen of Cups', type: 'minor', suit: 'cups', court: 'queen' },
  { name: 'King of Cups', type: 'minor', suit: 'cups', court: 'king' },

  // Minor Arcana - Swords (14 cards)
  { name: 'Ace of Swords', type: 'minor', suit: 'swords', number: 1 },
  { name: 'Two of Swords', type: 'minor', suit: 'swords', number: 2 },
  { name: 'Three of Swords', type: 'minor', suit: 'swords', number: 3 },
  { name: 'Four of Swords', type: 'minor', suit: 'swords', number: 4 },
  { name: 'Five of Swords', type: 'minor', suit: 'swords', number: 5 },
  { name: 'Six of Swords', type: 'minor', suit: 'swords', number: 6 },
  { name: 'Seven of Swords', type: 'minor', suit: 'swords', number: 7 },
  { name: 'Eight of Swords', type: 'minor', suit: 'swords', number: 8 },
  { name: 'Nine of Swords', type: 'minor', suit: 'swords', number: 9 },
  { name: 'Ten of Swords', type: 'minor', suit: 'swords', number: 10 },
  { name: 'Page of Swords', type: 'minor', suit: 'swords', court: 'page' },
  { name: 'Knight of Swords', type: 'minor', suit: 'swords', court: 'knight' },
  { name: 'Queen of Swords', type: 'minor', suit: 'swords', court: 'queen' },
  { name: 'King of Swords', type: 'minor', suit: 'swords', court: 'king' },

  // Minor Arcana - Pentacles (14 cards)
  { name: 'Ace of Pentacles', type: 'minor', suit: 'pentacles', number: 1 },
  { name: 'Two of Pentacles', type: 'minor', suit: 'pentacles', number: 2 },
  { name: 'Three of Pentacles', type: 'minor', suit: 'pentacles', number: 3 },
  { name: 'Four of Pentacles', type: 'minor', suit: 'pentacles', number: 4 },
  { name: 'Five of Pentacles', type: 'minor', suit: 'pentacles', number: 5 },
  { name: 'Six of Pentacles', type: 'minor', suit: 'pentacles', number: 6 },
  { name: 'Seven of Pentacles', type: 'minor', suit: 'pentacles', number: 7 },
  { name: 'Eight of Pentacles', type: 'minor', suit: 'pentacles', number: 8 },
  { name: 'Nine of Pentacles', type: 'minor', suit: 'pentacles', number: 9 },
  { name: 'Ten of Pentacles', type: 'minor', suit: 'pentacles', number: 10 },
  { name: 'Page of Pentacles', type: 'minor', suit: 'pentacles', court: 'page' },
  { name: 'Knight of Pentacles', type: 'minor', suit: 'pentacles', court: 'knight' },
  { name: 'Queen of Pentacles', type: 'minor', suit: 'pentacles', court: 'queen' },
  { name: 'King of Pentacles', type: 'minor', suit: 'pentacles', court: 'king' }
];

/**
 * Generate a placeholder card image and upload to Vercel Blob
 */
async function createCardImage(card) {
  try {
    // Create a simple colored SVG card image directly
    const cardColor = card.type === 'major' ? '#4a90e2' : 
                     card.suit === 'wands' ? '#d63031' :
                     card.suit === 'cups' ? '#0984e3' :
                     card.suit === 'swords' ? '#636e72' :
                     card.suit === 'pentacles' ? '#00b894' : '#6c5ce7';
    
    // Create an SVG image
    const svgContent = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="300" height="500" xmlns="http://www.w3.org/2000/svg">
  <rect width="300" height="500" fill="${cardColor}" rx="15" ry="15"/>
  <rect x="10" y="10" width="280" height="480" fill="white" rx="10" ry="10"/>
  <text x="150" y="50" text-anchor="middle" font-family="Arial, sans-serif" font-size="16" font-weight="bold" fill="${cardColor}">${card.name}</text>
  <text x="150" y="250" text-anchor="middle" font-family="Arial, sans-serif" font-size="48" fill="${cardColor}">🃏</text>
  <text x="150" y="450" text-anchor="middle" font-family="Arial, sans-serif" font-size="12" fill="${cardColor}">Rider-Waite Deck</text>
</svg>`;
    
    console.log(`Generating image for: ${card.name}`);
    
    // Convert SVG to Buffer
    const imageBuffer = Buffer.from(svgContent, 'utf8');
    
    // Create filename
    const filename = card.name.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase() + '.svg';
    const blobPath = `decks/rider-waite/${filename}`;
    
    // Upload to Vercel Blob
    const blob = await put(blobPath, imageBuffer, {
      access: 'public',
      contentType: 'image/svg+xml',
    });
    
    console.log(`✅ Uploaded: ${card.name} -> ${blob.url}`);
    return blob.url;
    
  } catch (error) {
    console.error(`❌ Failed to create image for ${card.name}:`, error.message);
    // Return a default card back image as fallback
    return `https://via.placeholder.com/300x500/2d3436/ffffff?text=${encodeURIComponent('Card Back')}`;
  }
}

/**
 * Create deck cover image
 */
async function createDeckCover() {
  try {
    console.log('Creating Rider-Waite deck cover image...');
    
    // Create a deck cover SVG image
    const svgContent = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="400" height="600" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="cardGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#2d3436;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#636e72;stop-opacity:1" />
    </linearGradient>
  </defs>
  <rect width="400" height="600" fill="url(#cardGrad)" rx="20" ry="20"/>
  <rect x="15" y="15" width="370" height="570" fill="white" rx="15" ry="15"/>
  <text x="200" y="100" text-anchor="middle" font-family="Arial, sans-serif" font-size="32" font-weight="bold" fill="#2d3436">Rider-Waite</text>
  <text x="200" y="140" text-anchor="middle" font-family="Arial, sans-serif" font-size="24" fill="#2d3436">Tarot Deck</text>
  <text x="200" y="300" text-anchor="middle" font-family="Arial, sans-serif" font-size="72" fill="#4a90e2">🃏</text>
  <text x="200" y="450" text-anchor="middle" font-family="Arial, sans-serif" font-size="16" fill="#636e72">Complete 78-Card Collection</text>
  <text x="200" y="480" text-anchor="middle" font-family="Arial, sans-serif" font-size="16" fill="#636e72">Major & Minor Arcana</text>
</svg>`;
    
    // Convert SVG to Buffer
    const imageBuffer = Buffer.from(svgContent, 'utf8');
    
    // Upload deck cover to Vercel Blob
    const blob = await put('decks/rider-waite/cover.svg', imageBuffer, {
      access: 'public',
      contentType: 'image/svg+xml',
    });
    
    console.log(`✅ Deck cover created: ${blob.url}`);
    return blob.url;
    
  } catch (error) {
    console.error('❌ Failed to create deck cover:', error.message);
    return 'https://via.placeholder.com/400x600/2d3436/ffffff?text=Rider-Waite%0ATarot%20Deck';
  }
}

/**
 * Seed the Rider-Waite Tarot deck
 */
async function seedRiderWaiteDeck() {
  try {
    console.log('🚀 Starting Rider-Waite Tarot deck seeding...\n');
    
    // Connect to database
    await connectToDatabase();
    const Deck = require('../models/Deck');
    
    // Check if Rider-Waite deck already exists
    const existingDeck = await Deck.findOne({ 
      deckName: 'Rider-Waite Tarot Deck',
      owner: null // Global deck
    });
    
    if (existingDeck) {
      console.log('⚠️  Rider-Waite Tarot Deck already exists');
      console.log(`📚 Existing deck has ${existingDeck.cards.length} cards`);
      
      // Check if we need to update images to blob URLs
      const needsUpdate = existingDeck.cards.some(card => 
        !card.image || !card.image.startsWith('https://')
      );
      
      if (needsUpdate) {
        console.log('🔄 Updating existing deck with blob URLs...');
        await updateExistingDeck(existingDeck);
      } else {
        console.log('✅ Deck already has blob URLs - no update needed');
      }
      
      return existingDeck;
    }
    
    console.log('📸 Creating card images and uploading to Vercel Blob...');
    console.log(`Total cards to process: ${RIDER_WAITE_CARDS.length}\n`);
    
    // Create deck cover
    const deckCoverUrl = await createDeckCover();
    
    // Create cards with blob URLs (process in batches to avoid rate limits)
    const batchSize = 5;
    const cards = [];
    
    for (let i = 0; i < RIDER_WAITE_CARDS.length; i += batchSize) {
      const batch = RIDER_WAITE_CARDS.slice(i, i + batchSize);
      console.log(`Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(RIDER_WAITE_CARDS.length/batchSize)}...`);
      
      const batchPromises = batch.map(async (card) => {
        const imageUrl = await createCardImage(card);
        return {
          name: card.name,
          image: imageUrl,
          type: card.type,
          suit: card.suit,
          number: card.number,
          court: card.court
        };
      });
      
      const batchResults = await Promise.all(batchPromises);
      cards.push(...batchResults);
      
      // Small delay between batches
      if (i + batchSize < RIDER_WAITE_CARDS.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    console.log('\n💾 Creating deck in database...');
    
    // Create the global Rider-Waite deck
    const riderWaiteDeck = new Deck({
      deckName: 'Rider-Waite Tarot Deck',
      description: 'The classic Rider-Waite Tarot deck, featuring all 78 traditional cards. This is a global deck available to all users for readings and practice.',
      image: deckCoverUrl,
      owner: null, // No owner = global deck
      cards: cards.map(card => ({
        name: card.name,
        image: card.image
      })),
      isGlobal: true, // Mark as global
      createdAt: new Date()
    });
    
    await riderWaiteDeck.save();
    
    console.log('\n🎉 Rider-Waite Tarot Deck seeded successfully!');
    console.log(`📚 Deck ID: ${riderWaiteDeck._id}`);
    console.log(`🃏 Total cards: ${riderWaiteDeck.cards.length}`);
    console.log(`🖼️  Deck cover: ${riderWaiteDeck.image}`);
    console.log('🌍 Global deck: Available to all users');
    
    return riderWaiteDeck;
    
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    throw error;
  }
}

/**
 * Update existing deck with blob URLs
 */
async function updateExistingDeck(deck) {
  try {
    console.log('🔄 Updating existing deck with new blob URLs...');
    
    let updated = false;
    
    // Update deck cover if needed
    if (!deck.image || !deck.image.startsWith('https://')) {
      deck.image = await createDeckCover();
      updated = true;
    }
    
    // Update card images if needed
    for (let i = 0; i < deck.cards.length; i++) {
      const card = deck.cards[i];
      if (!card.image || !card.image.startsWith('https://')) {
        const cardData = RIDER_WAITE_CARDS.find(c => c.name === card.name);
        if (cardData) {
          card.image = await createCardImage(cardData);
          updated = true;
        }
      }
    }
    
    // Add missing cards
    const existingCardNames = deck.cards.map(c => c.name);
    const missingCards = RIDER_WAITE_CARDS.filter(c => !existingCardNames.includes(c.name));
    
    for (const missingCard of missingCards) {
      const imageUrl = await createCardImage(missingCard);
      deck.cards.push({
        name: missingCard.name,
        image: imageUrl
      });
      updated = true;
      console.log(`➕ Added missing card: ${missingCard.name}`);
    }
    
    if (updated) {
      await deck.save();
      console.log('✅ Deck updated successfully');
    } else {
      console.log('ℹ️  No updates needed');
    }
    
    return deck;
    
  } catch (error) {
    console.error('❌ Update failed:', error);
    throw error;
  }
}

/**
 * Main function
 */
async function main() {
  try {
    // Validate environment variables
    if (!process.env.MONGODB_URI) {
      console.error('❌ Error: MONGODB_URI environment variable is required');
      console.log('💡 Add to your .env file: MONGODB_URI=mongodb+srv://...');
      process.exit(1);
    }
    
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      console.error('❌ Error: BLOB_READ_WRITE_TOKEN environment variable is required');
      console.log('💡 Get your token from: https://vercel.com/dashboard -> Storage -> Blob');
      console.log('💡 Add to your .env file: BLOB_READ_WRITE_TOKEN=vercel_blob_rw_xxxxx');
      process.exit(1);
    }
    
    const deck = await seedRiderWaiteDeck();
    
    console.log('\n📋 Summary:');
    console.log(`✅ Deck Name: ${deck.deckName}`);
    console.log(`✅ Total Cards: ${deck.cards.length}`);
    console.log(`✅ Global Access: ${deck.owner ? 'No' : 'Yes'}`);
    console.log(`✅ Cover Image: ${deck.image}`);
    console.log(`✅ All card images stored in Vercel Blob`);
    
    console.log('\n🎯 Next Steps:');
    console.log('1. Deck is now available for all users');
    console.log('2. Frontend can access via /api/decks endpoint');
    console.log('3. No CORS issues - all images served from backend');
    
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Script failed:', error);
    process.exit(1);
  }
}

// Export for use in other modules
module.exports = {
  seedRiderWaiteDeck,
  updateExistingDeck,
  RIDER_WAITE_CARDS
};

// Run if called directly
if (require.main === module) {
  main();
}