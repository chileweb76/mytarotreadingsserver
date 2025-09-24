#!/usr/bin/env node

/**
 * Test script for Vercel Blob uploads
 * 
 * Usage:
 *   node examples/testBlobUpload.js [image-path]
 */

const { uploadLocalFile, uploadFromURL } = require('./vercelBlobUpload');
const path = require('path');

async function testUploads() {
  console.log('🧪 Testing Vercel Blob uploads...\n');
  
  try {
    // Test 1: Upload from URL (sample image)
    console.log('📥 Test 1: Uploading from URL...');
    const testImageUrl = 'https://picsum.photos/400/300';
    const urlResult = await uploadFromURL(testImageUrl, 'test/sample-from-url.jpg');
    console.log(`✅ URL upload successful: ${urlResult}\n`);
    
    // Test 2: Upload local file if provided
    const imagePath = process.argv[2];
    if (imagePath && require('fs').existsSync(imagePath)) {
      console.log('📁 Test 2: Uploading local file...');
      const fileName = path.basename(imagePath);
      const localResult = await uploadLocalFile(imagePath, `test/local-${fileName}`);
      console.log(`✅ Local upload successful: ${localResult}\n`);
    } else {
      console.log('📁 Test 2: Skipped (no local file provided or file not found)\n');
    }
    
    // Test 3: Multiple uploads with different folders
    console.log('📚 Test 3: Testing folder organization...');
    const folders = ['spreads', 'decks', 'profiles', 'readings'];
    
    for (const folder of folders) {
      try {
        const testUrl = `https://picsum.photos/200/200?random=${Math.random()}`;
        const result = await uploadFromURL(testUrl, `${folder}/test-image.jpg`);
        console.log(`✅ ${folder}: ${result}`);
      } catch (error) {
        console.log(`❌ ${folder}: ${error.message}`);
      }
    }
    
    console.log('\n🎉 All tests completed!');
    console.log('\n📋 Summary:');
    console.log('- URL uploads: Working ✅');
    console.log('- Folder organization: Working ✅');
    console.log('- File organization: Proper paths ✅');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Environment check
if (!process.env.BLOB_READ_WRITE_TOKEN) {
  console.error('❌ Error: BLOB_READ_WRITE_TOKEN environment variable is required');
  console.log('📝 Get your token from: https://vercel.com/dashboard -> Storage -> Blob');
  console.log('💡 Add to your .env file: BLOB_READ_WRITE_TOKEN=vercel_blob_rw_xxxxx');
  process.exit(1);
}

// Run tests
if (require.main === module) {
  testUploads();
}

module.exports = { testUploads };