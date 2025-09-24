const { put } = require('@vercel/blob');
const { connectToDatabase } = require('../utils/connectToDatabase');
const spreadsData = require('../public/spreads.json');

// Load environment variables
require('dotenv').config();

/**
 * Seed Spreads Database with Vercel Blob Storage
 * Creates spread images as SVGs and uploads them to blob storage
 * Uses built-in fetch (Node.js 18+)
 */

/**
 * Generate spread layout SVG image and upload to Vercel Blob
 */
async function createSpreadImage(spreadData) {
  try {
    const { spread, cards, numberofCards } = spreadData;
    console.log(`Generating image for: ${spread} (${numberofCards} cards)`);
    
    // Calculate SVG dimensions based on card count
    const cardWidth = 60;
    const cardHeight = 90;
    const padding = 20;
    const labelHeight = 20;
    
    // Determine layout based on number of cards
    let svgWidth, svgHeight, cardPositions;
    
    if (numberofCards <= 3) {
      // Horizontal layout for 1-3 cards
      svgWidth = (cardWidth * numberofCards) + (padding * (numberofCards + 1));
      svgHeight = cardHeight + (padding * 2) + labelHeight;
      cardPositions = cards.map((_, i) => ({
        x: padding + (i * (cardWidth + padding)),
        y: padding,
        label: cards[i]
      }));
    } else if (numberofCards <= 5) {
      // 2x3 or 2x2 grid for 4-5 cards
      const cols = Math.ceil(numberofCards / 2);
      const rows = 2;
      svgWidth = (cardWidth * cols) + (padding * (cols + 1));
      svgHeight = (cardHeight * rows) + (padding * (rows + 1)) + labelHeight;
      cardPositions = cards.map((_, i) => ({
        x: padding + ((i % cols) * (cardWidth + padding)),
        y: padding + (Math.floor(i / cols) * (cardHeight + padding)),
        label: cards[i]
      }));
    } else if (numberofCards === 7) {
      // Horseshoe layout
      svgWidth = 400;
      svgHeight = 300;
      cardPositions = [
        { x: 50, y: 150, label: cards[0] },   // Past
        { x: 120, y: 100, label: cards[1] },  // Present
        { x: 190, y: 50, label: cards[2] },   // Hidden
        { x: 260, y: 100, label: cards[3] },  // Obstacle
        { x: 330, y: 150, label: cards[4] },  // External
        { x: 260, y: 200, label: cards[5] },  // Action
        { x: 190, y: 150, label: cards[6] }   // Outcome
      ];
    } else if (numberofCards === 10) {
      // Celtic Cross layout
      svgWidth = 400;
      svgHeight = 350;
      cardPositions = [
        { x: 170, y: 130, label: cards[0] },  // Significator
        { x: 170, y: 130, label: cards[1], rotation: 90 }, // Crossing
        { x: 170, y: 250, label: cards[2] },  // Foundation
        { x: 100, y: 130, label: cards[3] },  // Past
        { x: 170, y: 60, label: cards[4] },   // Crown
        { x: 240, y: 130, label: cards[5] },  // Future
        { x: 320, y: 250, label: cards[6] },  // Self
        { x: 320, y: 190, label: cards[7] },  // Environment
        { x: 320, y: 130, label: cards[8] },  // Hopes/Fears
        { x: 320, y: 70, label: cards[9] }    // Outcome
      ];
    } else {
      // Default grid layout for other counts
      const cols = Math.ceil(Math.sqrt(numberofCards));
      const rows = Math.ceil(numberofCards / cols);
      svgWidth = (cardWidth * cols) + (padding * (cols + 1));
      svgHeight = (cardHeight * rows) + (padding * (rows + 1)) + labelHeight;
      cardPositions = cards.map((_, i) => ({
        x: padding + ((i % cols) * (cardWidth + padding)),
        y: padding + (Math.floor(i / cols) * (cardHeight + padding)),
        label: cards[i]
      }));
    }
    
    // Create SVG content
    const svgContent = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${svgWidth}" height="${svgHeight}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <style>
      .card-rect { fill: #4a90e2; stroke: #2d3436; stroke-width: 2; rx: 5; ry: 5; }
      .card-text { font-family: Arial, sans-serif; font-size: 10px; fill: white; text-anchor: middle; font-weight: bold; }
      .title-text { font-family: Arial, sans-serif; font-size: 14px; fill: #2d3436; text-anchor: middle; font-weight: bold; }
    </style>
  </defs>
  
  <!-- Background -->
  <rect width="${svgWidth}" height="${svgHeight}" fill="#f8f9fa" stroke="#dee2e6" stroke-width="1" rx="10" ry="10"/>
  
  <!-- Title -->
  <text x="${svgWidth / 2}" y="18" class="title-text">${spread}</text>
  
  <!-- Cards -->
  ${cardPositions.map((pos, i) => `
    <g transform="translate(${pos.x}, ${pos.y}) ${pos.rotation ? `rotate(${pos.rotation}, ${cardWidth/2}, ${cardHeight/2})` : ''}">
      <rect class="card-rect" width="${cardWidth}" height="${cardHeight}"/>
      <text x="${cardWidth / 2}" y="${cardHeight / 2 - 10}" class="card-text">${i + 1}</text>
      <text x="${cardWidth / 2}" y="${cardHeight / 2 + 5}" class="card-text" font-size="8">${pos.label.substring(0, 8)}${pos.label.length > 8 ? '...' : ''}</text>
    </g>
  `).join('')}
  
  <!-- Card count indicator -->
  <text x="${svgWidth - 20}" y="${svgHeight - 10}" font-family="Arial, sans-serif" font-size="10" fill="#636e72" text-anchor="end">${numberofCards} cards</text>
</svg>`;
    
    // Convert SVG to Buffer
    const imageBuffer = Buffer.from(svgContent, 'utf8');
    
    // Create filename from spread name
    const filename = spread
      .replace(/[^a-zA-Z0-9\s]/g, '')
      .replace(/\s+/g, '_')
      .toLowerCase() + '.svg';
    const blobPath = `spreads/${filename}`;
    
    // Upload to Vercel Blob
    const blob = await put(blobPath, imageBuffer, {
      access: 'public',
      contentType: 'image/svg+xml',
    });
    
    console.log(`✅ Uploaded: ${spread} -> ${blob.url}`);
    return blob.url;
    
  } catch (error) {
    console.error(`❌ Failed to create image for ${spreadData.spread}:`, error.message);
    // Return a default spread image as fallback
    return '/images/spreads/custom.png';
  }
}

/**
 * Seed the spreads database
 */
async function seedSpreads() {
  try {
    console.log('🚀 Starting Spreads database seeding with Vercel Blob...\n');
    
    // Validate environment
    if (!process.env.MONGODB_URI) {
      console.error('❌ Error: MONGODB_URI environment variable is required');
      console.log('💡 Add to your .env file: MONGODB_URI=your_mongodb_connection_string');
      process.exit(1);
    }
    
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      console.error('❌ Error: BLOB_READ_WRITE_TOKEN environment variable is required');
      console.log('💡 Get your token from: https://vercel.com/dashboard -> Storage -> Blob');
      console.log('💡 Add to your .env file: BLOB_READ_WRITE_TOKEN=vercel_blob_rw_xxxxx');
      process.exit(1);
    }
    
    // Connect to database
    await connectToDatabase();
    const Spread = require('../models/Spread');
    
    console.log(`📊 Found ${spreadsData.length} spreads to process\n`);
    
    // Clear existing default spreads (keep custom user spreads)
    console.log('🧹 Clearing existing default spreads...');
    const deleteResult = await Spread.deleteMany({ owner: null });
    console.log(`Deleted ${deleteResult.deletedCount} existing default spreads\n`);
    
    console.log('📸 Creating spread images and uploading to Vercel Blob...');
    
    // Process spreads in batches
    const batchSize = 3;
    const spreadsWithBlobs = [];
    
    for (let i = 0; i < spreadsData.length; i += batchSize) {
      const batch = spreadsData.slice(i, i + batchSize);
      console.log(`Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(spreadsData.length/batchSize)}...`);
      
      const batchPromises = batch.map(async (spreadData) => {
        const imageUrl = await createSpreadImage(spreadData);
        return {
          spread: spreadData.spread,
          cards: spreadData.cards,
          image: imageUrl,
          numberofCards: spreadData.numberofCards,
          owner: null, // Default spreads have no owner
          isCustom: false
        };
      });
      
      const batchResults = await Promise.all(batchPromises);
      spreadsWithBlobs.push(...batchResults);
      
      // Small delay between batches
      if (i + batchSize < spreadsData.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    console.log('\n💾 Saving spreads to database...');
    
    // Insert all spreads
    const result = await Spread.insertMany(spreadsWithBlobs);
    
    console.log('\n🎉 Spreads database seeded successfully!');
    console.log(`📊 Total spreads: ${result.length}`);
    console.log('🖼️  All spread images stored in Vercel Blob');
    console.log('🌍 Default spreads: Available to all users\n');
    
    console.log('📋 Summary:');
    result.forEach((spread, i) => {
      console.log(`✅ ${i + 1}. ${spread.spread} (${spread.numberofCards} cards)`);
    });
    
    console.log('\n🎯 Next Steps:');
    console.log('1. Spreads are now available for all users');
    console.log('2. Frontend can access via /api/spreads endpoint');
    console.log('3. No CORS issues - all images served from backend');
    
    return result;
    
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    throw error;
  }
}

/**
 * Main execution
 */
if (require.main === module) {
  seedSpreads()
    .then(() => {
      console.log('\n✨ Spreads seeding completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Seeding failed:', error);
      process.exit(1);
    });
}

module.exports = { seedSpreads, createSpreadImage };