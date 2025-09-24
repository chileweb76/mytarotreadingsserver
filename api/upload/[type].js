/**
 * Unified Upload API for Vercel Blob Storage
 * Handles uploads for profiles, decks, readings, and spreads
 * Usage: POST /api/upload/:type where type is 'profile', 'deck', 'reading', or 'spread'
 */

const multer = require('multer')
const { uploadToBlob, deleteFromBlob } = require('../../utils/blobStorage')
const { allowedOrigins, allowedHostnames } = require('../../utils/corsConfig')

// Multer memory storage (keeps files in memory instead of disk)
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { 
    fileSize: 5 * 1024 * 1024, // 5MB max
    files: 5 // Max 5 files per request
  },
  fileFilter: (req, file, cb) => {
    // Only allow images
    if (file.mimetype.startsWith('image/')) {
      cb(null, true)
    } else {
      cb(new Error('Only image files are allowed'), false)
    }
  }
})

async function handler(req, res) {
  try {
    const origin = req.headers.origin;
    const requestHost = req.headers.host;
    
    // Set CORS headers
    const isAllowedOrigin = allowedOrigins.includes('*') || allowedOrigins.includes(origin);
    const isAllowedHost = allowedHostnames.includes('*') || allowedHostnames.includes(requestHost);
    
    if (isAllowedOrigin || isAllowedHost) {
      res.setHeader('Access-Control-Allow-Origin', origin || '*');
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-user-id');
      res.setHeader('Access-Control-Expose-Headers', 'Content-Length,X-Request-Id');
    }

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }
    
    // Extract upload type from URL path
    const urlParts = req.url.split('/')
    const uploadType = urlParts[urlParts.length - 1] // Last part of URL
    
    if (!['profile', 'deck', 'reading', 'spread'].includes(uploadType)) {
      return res.status(400).json({ error: 'Invalid upload type. Use: profile, deck, reading, or spread' })
    }
    
    if (req.method === 'POST') {
      // Handle file upload
      return new Promise((resolve) => {
        upload.array('files', 5)(req, res, async (err) => {
          try {
            if (err) {
              console.error('Multer error:', err)
              if (err.code === 'LIMIT_FILE_SIZE') {
                return res.status(400).json({ error: 'File too large (max 5MB)' })
              }
              return res.status(400).json({ error: err.message })
            }
            
            if (!req.files || req.files.length === 0) {
              return res.status(400).json({ error: 'No files uploaded' })
            }
            
            const uploadPromises = req.files.map(async (file) => {
              const result = await uploadToBlob(
                file.buffer,
                file.originalname,
                `${uploadType}s`, // profiles, decks, readings, spreads
                req.headers['x-user-id'] // Get user ID from header if provided
              )
              
              return {
                url: result.url,
                filename: result.filename,
                size: result.size,
                originalName: file.originalname
              }
            })
            
            const uploadResults = await Promise.all(uploadPromises)
            
            res.json({
              success: true,
              uploads: uploadResults,
              type: uploadType
            })
            
            resolve()
          } catch (error) {
            console.error('Upload processing error:', error)
            res.status(500).json({ error: 'Upload processing failed' })
            resolve()
          }
        })
      })
    } 
    
    else if (req.method === 'DELETE') {
      // Handle file deletion
      const { url } = req.body
      
      if (!url) {
        return res.status(400).json({ error: 'URL required for deletion' })
      }
      
      await deleteFromBlob(url)
      
      res.json({ success: true, message: 'File deleted' })
    }
    
    else {
      res.setHeader('Allow', 'POST, DELETE')
      res.status(405).json({ error: 'Method not allowed' })
    }
    
  } catch (error) {
    console.error('Upload API error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
}

module.exports = handler