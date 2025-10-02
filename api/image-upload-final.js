/**
 * Final blob upload endpoint with completely different naming and aggressive cache busting
 */
const { connectToDatabase } = require('../utils/connectToDatabase')
const { put } = require('@vercel/blob')
const multer = require('multer')
const Reading = require('../models/Reading')

// Configure multer for memory storage
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
})

module.exports = async (req, res) => {
  // ULTRA-AGGRESSIVE CORS headers - set immediately before any processing
  const origin = req.headers.origin || 'https://mytarotreadings.vercel.app'
  
  // Set ALL possible CORS headers with maximum permissiveness for debugging
  res.setHeader('Access-Control-Allow-Origin', '*') // Try wildcard first
  res.setHeader('Access-Control-Allow-Credentials', 'false') // Disable credentials to use wildcard
  res.setHeader('Access-Control-Allow-Methods', '*') // Allow all methods
  res.setHeader('Access-Control-Allow-Headers', '*') // Allow all headers
  res.setHeader('Access-Control-Expose-Headers', '*')
  res.setHeader('Access-Control-Max-Age', '0') // Disable preflight caching completely
  res.setHeader('Vary', 'Origin, Access-Control-Request-Method, Access-Control-Request-Headers')
  
  // Ultra-aggressive cache busting
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0, s-maxage=0')
  res.setHeader('Pragma', 'no-cache, no-store')
  res.setHeader('Expires', '-1')
  res.setHeader('Last-Modified', new Date().toUTCString())
  res.setHeader('ETag', `"${Date.now()}-${Math.random()}"`)
  
  // Add timestamp to all responses for debugging
  const timestamp = new Date().toISOString()
  
  console.log(`🔥 [FINAL UPLOAD ${timestamp}] Method: ${req.method}, Origin: ${origin}, URL: ${req.url}`)
  console.log(`🔥 [FINAL UPLOAD ${timestamp}] User-Agent: ${req.headers['user-agent']?.substring(0, 100)}`)
  
  if (req.method === 'OPTIONS') {
    console.log(`🟢 [FINAL UPLOAD ${timestamp}] OPTIONS preflight handled with wildcard CORS`)
    return res.status(200).json({ 
      success: true, 
      message: 'FINAL CORS preflight OK with wildcard headers',
      timestamp: timestamp,
      cacheId: `final-${Date.now()}-${Math.random()}`
    })
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed', timestamp })
  }
  
  try {
    const readingId = req.query.readingId || req.headers['x-reading-id'] || req.query.id
    console.log(`🔥 [FINAL UPLOAD ${timestamp}] Processing upload for reading: ${readingId}`)
    
    if (!readingId) {
      return res.status(400).json({ 
        error: 'Reading ID required in query param readingId or header x-reading-id',
        timestamp,
        received: { query: req.query, headers: Object.keys(req.headers) }
      })
    }
    
    await connectToDatabase()
    
    // Use multer to handle file upload
    upload.single('file')(req, res, async (err) => {
      if (err) {
        console.error(`❌ [FINAL UPLOAD ${timestamp}] Multer error:`, err)
        return res.status(400).json({ 
          error: 'File upload error: ' + err.message, 
          timestamp 
        })
      }
      
      if (!req.file) {
        console.error(`❌ [FINAL UPLOAD ${timestamp}] No file provided`)
        return res.status(400).json({ 
          error: 'No file provided - check form field name is "file"', 
          timestamp,
          bodyKeys: Object.keys(req.body || {}),
          files: req.files ? Object.keys(req.files) : 'no files'
        })
      }
      
      console.log(`🔥 [FINAL UPLOAD ${timestamp}] File received:`, {
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size
      })
      
      try {
        // Upload to Vercel Blob
        const filename = `reading-${readingId}-${Date.now()}.${req.file.originalname.split('.').pop()}`
        const blob = await put(filename, req.file.buffer, {
          access: 'public',
          contentType: req.file.mimetype,
        })
        
        console.log(`🟢 [FINAL UPLOAD ${timestamp}] Blob uploaded:`, blob.url)
        
        // Update the reading with the image URL
        const reading = await Reading.findByIdAndUpdate(
          readingId,
          { imageUrl: blob.url },
          { new: true }
        )
        
        if (!reading) {
          console.error(`❌ [FINAL UPLOAD ${timestamp}] Reading not found:`, readingId)
          return res.status(404).json({ 
            error: 'Reading not found', 
            readingId,
            timestamp 
          })
        }
        
        console.log(`🟢 [FINAL UPLOAD ${timestamp}] Reading updated successfully`)
        
        res.status(200).json({
          success: true,
          imageUrl: blob.url,
          readingId: readingId,
          message: 'Image uploaded successfully via FINAL endpoint',
          timestamp,
          cacheId: `final-success-${Date.now()}`
        })
        
      } catch (uploadError) {
        console.error(`❌ [FINAL UPLOAD ${timestamp}] Upload error:`, uploadError)
        res.status(500).json({ 
          error: 'Upload failed: ' + uploadError.message,
          timestamp 
        })
      }
    })
    
  } catch (error) {
    console.error(`❌ [FINAL UPLOAD ${timestamp}] Unexpected error:`, error)
    res.status(500).json({ 
      error: 'Something went wrong: ' + error.message,
      timestamp 
    })
  }
}