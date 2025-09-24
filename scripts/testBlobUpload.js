const { put } = require('@vercel/blob');
require('dotenv').config();

async function testBlobUpload() {
  try {
    console.log('Testing Vercel Blob upload...');
    console.log('Token:', process.env.BLOB_READ_WRITE_TOKEN ? 'Found' : 'Missing');
    
    // Create a simple test image (1x1 pixel PNG)
    const testImageBuffer = Buffer.from([
      0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG signature
      0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52, // IHDR chunk
      0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, // 1x1 pixel
      0x01, 0x00, 0x00, 0x00, 0x00, 0x37, 0x6E, 0xF9,
      0x24, 0x00, 0x00, 0x00, 0x0A, 0x49, 0x44, 0x41,
      0x54, 0x78, 0x9C, 0x62, 0x00, 0x00, 0x00, 0x02,
      0x00, 0x01, 0xE2, 0x21, 0xBC, 0x33, 0x00, 0x00,
      0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42,
      0x60, 0x82
    ]);
    
    console.log('Uploading test image...');
    const blob = await put('test/test-image.png', testImageBuffer, {
      access: 'public',
      contentType: 'image/png',
    });
    
    console.log('✅ Upload successful!');
    console.log('Blob URL:', blob.url);
    
  } catch (error) {
    console.error('❌ Upload failed:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      status: error.status,
      stack: error.stack?.split('\n').slice(0, 3).join('\n')
    });
  }
}

testBlobUpload();