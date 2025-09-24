const { put } = require('@vercel/blob');
const fs = require('fs');
const path = require('path');

/**
 * Examples of uploading files to Vercel Blob storage
 */

// Example 1: Upload from local file path
async function uploadLocalFile(filePath, blobPath) {
  try {
    // Read the file
    const fileBuffer = fs.readFileSync(filePath);
    
    // Determine content type from file extension
    const ext = path.extname(filePath).toLowerCase();
    const contentType = ext === '.png' ? 'image/png' : 
                       ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' :
                       ext === '.gif' ? 'image/gif' : 
                       ext === '.webp' ? 'image/webp' : 'image/jpeg';
    
    // Upload to Vercel Blob
    const blob = await put(blobPath, fileBuffer, {
      access: 'public',
      contentType: contentType,
    });
    
    console.log(`✅ Uploaded: ${filePath} -> ${blob.url}`);
    return blob.url;
  } catch (error) {
    console.error('❌ Upload failed:', error);
    throw error;
  }
}

// Example 2: Upload from URL (fetch remote image)
async function uploadFromURL(imageUrl, blobPath) {
  try {
    const fetch = require('node-fetch');
    
    // Fetch the image
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch ${imageUrl}: ${response.statusText}`);
    }
    
    // Get the image buffer and content type
    const imageBuffer = await response.buffer();
    const contentType = response.headers.get('content-type') || 'image/jpeg';
    
    // Upload to Vercel Blob
    const blob = await put(blobPath, imageBuffer, {
      access: 'public',
      contentType: contentType,
    });
    
    console.log(`✅ Uploaded from URL: ${imageUrl} -> ${blob.url}`);
    return blob.url;
  } catch (error) {
    console.error('❌ URL upload failed:', error);
    throw error;
  }
}

// Example 3: Upload from Express multer file upload
async function uploadFromMulter(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    // Get file info from multer
    const file = req.file;
    const fileName = `${Date.now()}-${file.originalname}`;
    const blobPath = `uploads/${fileName}`;
    
    // Upload buffer directly to Vercel Blob
    const blob = await put(blobPath, file.buffer, {
      access: 'public',
      contentType: file.mimetype,
    });
    
    console.log(`✅ Uploaded via multer: ${file.originalname} -> ${blob.url}`);
    res.json({ 
      success: true, 
      url: blob.url,
      filename: fileName 
    });
    
    return blob.url;
  } catch (error) {
    console.error('❌ Multer upload failed:', error);
    res.status(500).json({ error: 'Upload failed' });
  }
}

// Example 4: Upload with custom metadata and folder organization
async function uploadWithMetadata(filePath, folder, metadata = {}) {
  try {
    const fileBuffer = fs.readFileSync(filePath);
    const fileName = path.basename(filePath);
    const ext = path.extname(filePath).toLowerCase();
    
    // Create organized blob path
    const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const blobPath = `${folder}/${timestamp}/${fileName}`;
    
    // Determine content type
    const contentType = ext === '.png' ? 'image/png' : 
                       ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' :
                       ext === '.gif' ? 'image/gif' : 'image/jpeg';
    
    // Upload with metadata
    const blob = await put(blobPath, fileBuffer, {
      access: 'public',
      contentType: contentType,
      // Add custom metadata (these become response headers)
      cacheControlMaxAge: 31536000, // 1 year cache
    });
    
    console.log(`✅ Uploaded with metadata: ${blobPath} -> ${blob.url}`);
    return {
      url: blob.url,
      path: blobPath,
      metadata: metadata
    };
  } catch (error) {
    console.error('❌ Metadata upload failed:', error);
    throw error;
  }
}

// Example 5: Batch upload multiple files
async function batchUpload(files, folder) {
  const results = [];
  
  for (const filePath of files) {
    try {
      if (fs.existsSync(filePath)) {
        const fileName = path.basename(filePath);
        const blobPath = `${folder}/${fileName}`;
        const url = await uploadLocalFile(filePath, blobPath);
        results.push({ filePath, blobPath, url, status: 'success' });
      } else {
        results.push({ filePath, status: 'error', error: 'File not found' });
      }
    } catch (error) {
      results.push({ filePath, status: 'error', error: error.message });
    }
  }
  
  return results;
}

module.exports = {
  uploadLocalFile,
  uploadFromURL,
  uploadFromMulter,
  uploadWithMetadata,
  batchUpload
};

// Example usage if run directly
if (require.main === module) {
  async function examples() {
    console.log('🚀 Vercel Blob Upload Examples\n');
    
    // Example usage:
    
    // 1. Upload a local file
    // await uploadLocalFile('./local-image.jpg', 'images/my-image.jpg');
    
    // 2. Upload from a URL
    // await uploadFromURL('https://example.com/image.jpg', 'images/remote-image.jpg');
    
    // 3. Batch upload
    // const files = ['./image1.jpg', './image2.png'];
    // const results = await batchUpload(files, 'batch-uploads');
    // console.log('Batch upload results:', results);
    
    console.log('📝 Examples ready to run - uncomment the lines above');
  }
  
  examples();
}