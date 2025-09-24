// Serverless uploads endpoint to serve uploaded files
// This replaces express.static('/uploads') for serverless environments

const fs = require('fs')
const path = require('path')
const { getUploadsDir } = require('../../utils/uploads')
const { allowedOrigins, allowedHostnames } = require('../../utils/corsConfig')

async function handler(req, res) {
  try {
    const origin = req.headers.origin;
    const requestHost = req.headers.host;
    
    // Always set CORS headers for all requests
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-user-id, X-Requested-With, Accept, Origin');
    res.setHeader('Vary', 'Origin');

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }
    
    // Extract the file path from the URL
    // URL format: /api/uploads/some/file.jpg
    const filePath = req.url.replace('/api/uploads', '').replace(/^\//, '')
    console.log('Uploads endpoint requested:', filePath) // Debug log
    
    if (!filePath) {
      return res.status(400).json({ error: 'File path required' })
    }

    // Security: prevent directory traversal
    if (filePath.includes('..') || filePath.includes('\\')) {
      return res.status(400).json({ error: 'Invalid file path' })
    }

    // Handle legacy Google profile images that were migrated to Blob storage
    if (filePath.startsWith('google-') && filePath.endsWith('.jpg')) {
      return res.status(410).json({ 
        error: 'File migrated to cloud storage',
        message: 'This Google profile image has been migrated to Vercel Blob storage. Please refresh your profile to get the updated URL.'
      })
    }

    const uploadsDir = getUploadsDir()
    const fullPath = path.join(uploadsDir, filePath)

    // Check if file exists
    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ error: 'File not found' })
    }

    // Get file stats for headers
    const stats = fs.statSync(fullPath)
    const ext = path.extname(filePath).toLowerCase()
    
    // Set appropriate content type based on file extension
    let contentType = 'application/octet-stream'
    switch (ext) {
      case '.jpg':
      case '.jpeg':
        contentType = 'image/jpeg'
        break
      case '.png':
        contentType = 'image/png'
        break
      case '.gif':
        contentType = 'image/gif'
        break
      case '.webp':
        contentType = 'image/webp'
        break
    }

    // Set response headers
    res.setHeader('Content-Type', contentType)
    res.setHeader('Content-Length', stats.size)
    res.setHeader('Cache-Control', 'public, max-age=31536000') // Cache for 1 year
    res.setHeader('ETag', `"${stats.mtime.getTime()}-${stats.size}"`)

    // Stream the file
    const fileStream = fs.createReadStream(fullPath)
    fileStream.pipe(res)
    
  } catch (error) {
    console.error('Uploads endpoint error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}

module.exports = handler