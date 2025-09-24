/**
 * Vercel Blob Upload Utility
 * Replaces multer disk storage with cloud-based Vercel Blob storage
 * Handles uploads for profile pictures, deck images, reading images, and spreads
 */

const { put, del } = require('@vercel/blob')
const crypto = require('crypto')
const path = require('path')

/**
 * Upload a file buffer to Vercel Blob storage
 * @param {Buffer} buffer - File buffer 
 * @param {string} originalName - Original filename
 * @param {string} folder - Folder/prefix for organization (e.g., 'profiles', 'decks', 'readings')
 * @param {string} userId - Optional user ID for user-specific folders
 * @returns {Promise<{url: string, pathname: string, filename: string}>}
 */
async function uploadToBlob(buffer, originalName, folder = 'uploads', userId = null) {
  try {
    // Generate a unique filename
    const timestamp = Date.now()
    const randomId = crypto.randomBytes(6).toString('hex')
    const ext = path.extname(originalName) || ''
    const basename = path.basename(originalName, ext).replace(/[^a-zA-Z0-9-_]/g, '_')
    const filename = `${basename}-${timestamp}-${randomId}${ext}`
    
    // Build the blob pathname (this becomes the URL path)
    let blobPath = folder
    if (userId) {
      blobPath += `/${userId}`
    }
    blobPath += `/${filename}`
    
    // Upload to Vercel Blob
    const blob = await put(blobPath, buffer, {
      access: 'public',
      addRandomSuffix: false // We're already adding our own suffix
    })
    
    return {
      url: blob.url,
      pathname: blobPath,
      filename: filename,
      size: buffer.length
    }
  } catch (error) {
    console.error('Blob upload error:', error)
    throw new Error(`Upload failed: ${error.message}`)
  }
}

/**
 * Delete a file from Vercel Blob storage
 * @param {string} url - The blob URL to delete
 * @returns {Promise<void>}
 */
async function deleteFromBlob(url) {
  try {
    if (!url || !url.includes('blob.vercel-storage.com')) {
      console.warn('Invalid blob URL for deletion:', url)
      return
    }
    await del(url)
  } catch (error) {
    console.error('Blob deletion error:', error)
    // Don't throw - deletion failures shouldn't break the main operation
  }
}

/**
 * Multer-like middleware for Vercel Blob uploads
 * Replaces multer.diskStorage with blob storage
 * @param {string} folder - Storage folder (e.g., 'profiles', 'decks', 'readings')
 * @param {number} maxSize - Max file size in bytes (default 5MB)
 * @returns {Function} Express middleware
 */
function createBlobUploadMiddleware(folder = 'uploads', maxSize = 5 * 1024 * 1024) {
  return async (req, res, next) => {
    try {
      // Check if there's a file upload
      if (!req.body || (!req.files && !req.file)) {
        // If using raw multer, the file might be in req.file
        return next()
      }
      
      // Handle single file upload (req.file) or multiple (req.files)
      const files = req.files || (req.file ? [req.file] : [])
      
      for (const file of files) {
        if (!file.buffer && file.path) {
          // If it's a multer disk file, read it
          const fs = require('fs')
          file.buffer = fs.readFileSync(file.path)
          // Clean up temp file
          try { fs.unlinkSync(file.path) } catch (e) {}
        }
        
        if (!file.buffer) {
          continue
        }
        
        // Size check
        if (file.buffer.length > maxSize) {
          return res.status(400).json({ 
            error: `File too large. Max size: ${Math.round(maxSize / 1024 / 1024)}MB` 
          })
        }
        
        // Upload to blob
        const result = await uploadToBlob(
          file.buffer, 
          file.originalname || file.filename || 'upload',
          folder,
          req.user?._id?.toString()
        )
        
        // Add blob info to the file object
        file.blobUrl = result.url
        file.blobPath = result.pathname
        file.blobFilename = result.filename
      }
      
      next()
    } catch (error) {
      console.error('Blob upload middleware error:', error)
      res.status(500).json({ error: 'Upload failed' })
    }
  }
}

/**
 * Extract just the blob URLs from uploaded files
 * @param {Object|Array} files - req.file or req.files 
 * @returns {string|Array<string>} Blob URL(s)
 */
function getBlobUrls(files) {
  if (Array.isArray(files)) {
    return files.map(f => f.blobUrl).filter(Boolean)
  }
  return files?.blobUrl || null
}

module.exports = {
  uploadToBlob,
  deleteFromBlob,
  createBlobUploadMiddleware,
  getBlobUrls
}