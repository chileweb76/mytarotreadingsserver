/**
 * Deck-specific Blob Storage Utility
 * Handles hierarchical folder structure: decks/{deckId}/{owner}/{type}/filename
 * - type can be: 'cover' for deck images, 'cards' for card images
 */

const { put, del } = require('@vercel/blob')
const crypto = require('crypto')
const path = require('path')
const User = require('../models/User')

/**
 * Get appropriate Content-Type based on file extension
 */
function getContentType(ext) {
  const contentTypes = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.bmp': 'image/bmp',
    '.tiff': 'image/tiff',
    '.tif': 'image/tiff'
  }
  
  return contentTypes[ext.toLowerCase()] || 'application/octet-stream'
}

/**
 * Sanitize filename for safe storage
 */
function sanitizeFilename(name) {
  return name
    .replace(/[^a-zA-Z0-9-_\.]/g, '_')
    .replace(/_+/g, '_')
    .toLowerCase()
}

/**
 * Upload deck cover image
 * Path structure: decks/{deckId}/{ownerUsername}/cover/{filename}
 * 
 * @param {Buffer} buffer - File buffer
 * @param {string} originalName - Original filename
 * @param {string} deckId - Deck MongoDB ID
 * @param {string} ownerId - Owner's MongoDB user ID
 * @returns {Promise<{url: string, pathname: string}>}
 */
async function uploadDeckCover(buffer, originalName, deckId, ownerId) {
  try {
    // Get owner's username for folder naming
    const owner = await User.findById(ownerId)
    const ownerUsername = owner?.username || ownerId
    
    // Generate filename
    const ext = path.extname(originalName) || '.jpg'
    const filename = `cover${ext}`
    
    // Build hierarchical path: decks/{deckId}/{ownerUsername}/cover/{filename}
    const blobPath = `decks/${deckId}/${sanitizeFilename(ownerUsername)}/cover/${filename}`
    
    // Upload to Vercel Blob
    const blob = await put(blobPath, buffer, {
      access: 'public',
      addRandomSuffix: false,
      contentType: getContentType(ext)
    })
    
    return {
      url: blob.url,
      pathname: blobPath,
      filename: filename,
      size: buffer.length
    }
  } catch (error) {
    console.error('Deck cover upload error:', error)
    throw new Error(`Deck cover upload failed: ${error.message}`)
  }
}

/**
 * Upload deck card image
 * Path structure: decks/{deckId}/{ownerUsername}/cards/{cardName}.ext
 * 
 * @param {Buffer} buffer - File buffer
 * @param {string} originalName - Original filename
 * @param {string} cardName - Card name (e.g., "The Fool", "Ace of Cups")
 * @param {string} deckId - Deck MongoDB ID
 * @param {string} ownerId - Owner's MongoDB user ID
 * @returns {Promise<{url: string, pathname: string}>}
 */
async function uploadDeckCard(buffer, originalName, cardName, deckId, ownerId) {
  try {
    // Get owner's username for folder naming
    const owner = await User.findById(ownerId)
    const ownerUsername = owner?.username || ownerId
    
    // Generate filename from card name
    const ext = path.extname(originalName) || '.jpg'
    const safeCardName = sanitizeFilename(cardName)
    const filename = `${safeCardName}${ext}`
    
    // Build hierarchical path: decks/{deckId}/{ownerUsername}/cards/{cardName}.ext
    const blobPath = `decks/${deckId}/${sanitizeFilename(ownerUsername)}/cards/${filename}`
    
    // Upload to Vercel Blob
    const blob = await put(blobPath, buffer, {
      access: 'public',
      addRandomSuffix: false,
      contentType: getContentType(ext)
    })
    
    return {
      url: blob.url,
      pathname: blobPath,
      filename: filename,
      cardName: cardName,
      size: buffer.length
    }
  } catch (error) {
    console.error('Deck card upload error:', error)
    throw new Error(`Card upload failed: ${error.message}`)
  }
}

/**
 * Delete a file from Vercel Blob storage
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
 * Create deck folder structure when a new deck is created
 * This is a placeholder that returns the expected path structure
 * 
 * @param {string} deckId - Deck MongoDB ID
 * @param {string} ownerId - Owner's MongoDB user ID
 * @returns {Promise<{deckPath: string, coverPath: string, cardsPath: string}>}
 */
async function createDeckFolderStructure(deckId, ownerId) {
  try {
    const owner = await User.findById(ownerId)
    const ownerUsername = sanitizeFilename(owner?.username || ownerId)
    
    return {
      deckPath: `decks/${deckId}/${ownerUsername}`,
      coverPath: `decks/${deckId}/${ownerUsername}/cover`,
      cardsPath: `decks/${deckId}/${ownerUsername}/cards`
    }
  } catch (error) {
    console.error('Error creating deck folder structure:', error)
    throw error
  }
}

module.exports = {
  uploadDeckCover,
  uploadDeckCard,
  deleteFromBlob,
  createDeckFolderStructure
}
