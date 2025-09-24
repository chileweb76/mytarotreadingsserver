// Serverless uploads endpoint to serve uploaded files
// This replaces express.static('/uploads') for serverless environments

const fs = require('fs')
const path = require('path')
const { getUploadsDir } = require('../../utils/uploads')

async function handler(req, res) {
  try {
    // Extract the file path from the URL
    // URL format: /api/uploads/some/file.jpg
    const filePath = req.url.replace('/api/uploads', '').replace(/^\//, '')
    
    if (!filePath) {
      return res.status(400).json({ error: 'File path required' })
    }

    // Security: prevent directory traversal
    if (filePath.includes('..') || filePath.includes('\\')) {
      return res.status(400).json({ error: 'Invalid file path' })
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