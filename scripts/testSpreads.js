const { connectToDatabase } = require('../utils/connectToDatabase');
require('dotenv').config();

/**
 * Test spreads functionality and verify blob URLs work
 */
async function testSpreads() {
  try {
    console.log('🧪 Testing spreads functionality...\n');
    
    await connectToDatabase();
    const Spread = require('../models/Spread');
    
    // Get all spreads
    const spreads = await Spread.find({}).sort({ numberofCards: 1 });
    
    console.log(`✅ Found ${spreads.length} spreads in database\n`);
    
    // Test a few spread images
    console.log('🖼️  Testing spread images...');
    
    for (let i = 0; i < Math.min(3, spreads.length); i++) {
      const spread = spreads[i];
      try {
        console.log(`Testing: ${spread.spread}`);
        console.log(`URL: ${spread.image}`);
        
        const response = await fetch(spread.image);
        console.log(`Status: ${response.status} ${response.ok ? '✅' : '❌'}`);
        console.log(`Content-Type: ${response.headers.get('content-type')}`);
        console.log(`Size: ${response.headers.get('content-length')} bytes`);
        console.log('');
      } catch (error) {
        console.error(`❌ Failed to fetch ${spread.spread}:`, error.message);
      }
    }
    
    console.log('📊 Spread Statistics:');
    const stats = spreads.reduce((acc, spread) => {
      acc[spread.numberofCards] = (acc[spread.numberofCards] || 0) + 1;
      return acc;
    }, {});
    
    Object.entries(stats)
      .sort(([a], [b]) => parseInt(a) - parseInt(b))
      .forEach(([cards, count]) => {
        console.log(`  ${cards} cards: ${count} spread${count > 1 ? 's' : ''}`);
      });
    
    console.log('\n🎯 All spreads ready for use!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    throw error;
  }
}

if (require.main === module) {
  testSpreads()
    .then(() => {
      console.log('\n✨ Spreads test completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Test failed:', error);
      process.exit(1);
    });
}

module.exports = { testSpreads };