const { put } = require('@vercel/blob');
const fs = require('fs');
const path = require('path');

/**
 * Utility to migrate images from frontend/local storage to Vercel Blob
 * Uses built-in fetch (Node.js 18+)
 */

const FRONTEND_BASE_URL = 'https://mytarotreadings.vercel.app';

/**
 * Upload a file to Vercel Blob storage
 */
async function uploadToBlob(filePath, fileName, folder = 'images') {
  try {
    let fileBuffer;
    let contentType;

    // Handle different file sources
    if (filePath.startsWith('http')) {
      // Remote file (from frontend)
      console.log(`Fetching remote image: ${filePath}`);
      const response = await fetch(filePath);
      if (!response.ok) {
        throw new Error(`Failed to fetch ${filePath}: ${response.statusText}`);
      }
      // Node's global fetch provides arrayBuffer(); convert to Buffer.
      const arrayBuffer = await response.arrayBuffer();
      fileBuffer = Buffer.from(arrayBuffer);
      // Prefer the server-provided content-type, but fall back to common types
      contentType = response.headers.get('content-type') || 'image/jpeg';
      // If content-type is generic or missing and the URL ends with .svg, set it explicitly
      if ((!contentType || contentType === 'application/octet-stream' || contentType === 'text/plain') && filePath.toLowerCase().endsWith('.svg')) {
        contentType = 'image/svg+xml'
      }
    } else if (fs.existsSync(filePath)) {
      // Local file
      console.log(`Reading local file: ${filePath}`);
      fileBuffer = fs.readFileSync(filePath);
      const ext = path.extname(fileName).toLowerCase();
      contentType = ext === '.png' ? 'image/png' : 
                   ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' :
                   ext === '.gif' ? 'image/gif' : 'image/jpeg';
    } else {
      throw new Error(`File not found: ${filePath}`);
    }

    // Upload to Vercel Blob
    const blobPath = `${folder}/${fileName}`;
    console.log(`Uploading to blob: ${blobPath}`);
    
    const blob = await put(blobPath, fileBuffer, {
      access: 'public',
      contentType: contentType,
    });

    console.log(`✅ Uploaded: ${blobPath} -> ${blob.url}`);
    return blob.url;
  } catch (error) {
    console.error(`❌ Failed to upload ${fileName}:`, error.message);
    throw error;
  }
}

/**
 * Migrate spread images from frontend to Vercel Blob
 */
async function migrateSpreadImages() {
  console.log('🔄 Starting spread images migration...');
  
  const Spread = require('../models/Spread');
  const spreads = await Spread.find({});
  
  for (const spread of spreads) {
    if (spread.image && spread.image.startsWith('/images/spreads/')) {
      try {
        const imagePath = spread.image;
        const fileName = path.basename(imagePath);
        const remoteUrl = `${FRONTEND_BASE_URL}${imagePath}`;
        
        console.log(`Migrating spread "${spread.spread}": ${imagePath}`);
        
        const blobUrl = await uploadToBlob(remoteUrl, fileName, 'spreads');
        
        // Update spread with new blob URL
        spread.image = blobUrl;
        await spread.save();
        
        console.log(`✅ Updated spread "${spread.spread}" with blob URL`);
      } catch (error) {
        console.error(`❌ Failed to migrate spread image for "${spread.spread}":`, error.message);
        // Continue with next spread
      }
    }
  }
  
  console.log('✅ Spread images migration complete');
}

/**
 * Migrate deck images from frontend to Vercel Blob
 */
async function migrateDeckImages() {
  console.log('🔄 Starting deck images migration...');
  
  const Deck = require('../models/Deck');
  const decks = await Deck.find({});
  
  for (const deck of decks) {
    // Migrate deck cover image
    if (deck.image && (deck.image.startsWith('/images/') || deck.image.startsWith('http'))) {
      try {
        const imagePath = deck.image;
        const fileName = `${deck.deckName.replace(/[^a-zA-Z0-9]/g, '_')}_cover.jpg`;
        const sourceUrl = imagePath.startsWith('http') ? imagePath : `${FRONTEND_BASE_URL}${imagePath}`;
        
        console.log(`Migrating deck cover "${deck.deckName}": ${imagePath}`);
        
        const blobUrl = await uploadToBlob(sourceUrl, fileName, 'decks');
        
        // Update deck with new blob URL
        deck.image = blobUrl;
        await deck.save();
        
        console.log(`✅ Updated deck "${deck.deckName}" cover with blob URL`);
      } catch (error) {
        console.error(`❌ Failed to migrate deck cover for "${deck.deckName}":`, error.message);
      }
    }
    
    // Migrate individual card images
    if (deck.cards && deck.cards.length > 0) {
      for (let i = 0; i < deck.cards.length; i++) {
        const card = deck.cards[i];
        if (card.image && card.image.startsWith('/images/')) {
          try {
            const imagePath = card.image;
            const fileName = `${deck.deckName.replace(/[^a-zA-Z0-9]/g, '_')}_${card.name.replace(/[^a-zA-Z0-9]/g, '_')}.jpg`;
            const sourceUrl = `${FRONTEND_BASE_URL}${imagePath}`;
            
            console.log(`Migrating card "${card.name}" from deck "${deck.deckName}"`);
            
            const blobUrl = await uploadToBlob(sourceUrl, fileName, `decks/${deck._id}`);
            
            // Update card with new blob URL
            deck.cards[i].image = blobUrl;
            
            console.log(`✅ Updated card "${card.name}" with blob URL`);
          } catch (error) {
            console.error(`❌ Failed to migrate card image "${card.name}":`, error.message);
          }
        }
      }
      
      // Save deck with updated card images
      if (deck.isModified()) {
        await deck.save();
        console.log(`✅ Saved updated deck "${deck.deckName}"`);
      }
    }
  }
  
  console.log('✅ Deck images migration complete');
}

/**
 * Run complete image migration
 */
async function migrateAllImages() {
  try {
    console.log('🚀 Starting complete image migration to Vercel Blob...');
    
  // Connect to database (connectToDatabase exports an object with connectToDatabase)
  await require('../utils/connectToDatabase').connectToDatabase();
    
    await migrateSpreadImages();
    await migrateDeckImages();
    
    console.log('🎉 Complete image migration finished successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Export functions for individual use
module.exports = {
  uploadToBlob,
  migrateSpreadImages,
  migrateDeckImages,
  migrateAllImages
};

// Run migration if called directly
if (require.main === module) {
  migrateAllImages();
}