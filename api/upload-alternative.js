/**
 * Alternative blob upload endpoint with completely different naming to bypass any caching
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
  // Set aggressive CORS headers immediately - no middleware dependencies
  const origin = req.headers.origin
  
  // Set headers synchronously to avoid any timing issues
  res.setHeader('Access-Control-Allow-Origin', origin || 'https://mytarotreadings.vercel.app')
  res.setHeader('Access-Control-Allow-Credentials', 'true')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-user-id, X-Requested-With, Accept, Origin, x-vercel-blob-store, x-reading-id, User-Agent, Cache-Control, Pragma')
  res.setHeader('Access-Control-Expose-Headers', 'Content-Length, X-Request-Id')
  res.setHeader('Vary', 'Origin')
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0')
  res.setHeader('Pragma', 'no-cache')
  res.setHeader('Expires', '0')
  res.setHeader('Last-Modified', new Date().toUTCString())
  
  console.log('🔵 [Upload Alternative] Method:', req.method, 'Origin:', origin, 'URL:', req.url)
  console.log('🔵 [Upload Alternative] Headers:', JSON.stringify({
    origin: req.headers.origin,
    'user-agent': req.headers['user-agent']?.substring(0, 50),
    'access-control-request-method': req.headers['access-control-request-method'],
    'access-control-request-headers': req.headers['access-control-request-headers']
  }, null, 2))
  
  if (req.method === 'OPTIONS') {
    console.log('🟢 [Upload Alternative] OPTIONS handled successfully')
    return res.status(200).json({ 
      success: true, 
      message: 'CORS preflight OK for alternative upload endpoint',
      timestamp: new Date().toISOString()
    })
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }
  
  try {
    const readingId = req.query.readingId || req.headers['x-reading-id']
    console.log('🔵 [Upload Alternative] Processing upload for reading:', readingId)
    
    if (!readingId) {
      return res.status(400).json({ error: 'Reading ID required' })
    }
    
    await connectToDatabase()
    
    // Use multer to handle file upload
    upload.single('file')(req, res, async (err) => {
      if (err) {
        console.error('❌ [Upload Alternative] Multer error:', err)
        return res.status(400).json({ error: 'File upload error: ' + err.message })
      }
      
      if (!req.file) {
        console.error('❌ [Upload Alternative] No file provided')
        return res.status(400).json({ error: 'No file provided' })
      }
      
      console.log('🔵 [Upload Alternative] File received:', {
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
        
        console.log('🟢 [Upload Alternative] Blob uploaded:', blob.url)
        
        // Update the reading with the image URL
        const reading = await Reading.findByIdAndUpdate(
          readingId,
          { imageUrl: blob.url },
          { new: true }
        )
        
        if (!reading) {
          console.error('❌ [Upload Alternative] Reading not found:', readingId)
          return res.status(404).json({ error: 'Reading not found' })
        }
        
        console.log('🟢 [Upload Alternative] Reading updated successfully')
        
        res.status(200).json({
          success: true,
          imageUrl: blob.url,
          readingId: readingId,
          message: 'Image uploaded successfully via alternative endpoint'
        })
        
      } catch (uploadError) {
        console.error('❌ [Upload Alternative] Upload error:', uploadError)
        res.status(500).json({ error: 'Upload failed: ' + uploadError.message })
      }
    })
    
  } catch (error) {
    console.error('❌ [Upload Alternative] Unexpected error:', error)
    res.status(500).json({ error: 'Something went wrong!' })
  }
}