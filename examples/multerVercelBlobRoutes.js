const express = require('express');
const router = express.Router();
const multer = require('multer');
const { put } = require('@vercel/blob');
const path = require('path');

/**
 * Modern Multer + Vercel Blob integration
 * Stores uploaded files directly in Vercel Blob instead of local filesystem
 */

// Configure multer to store files in memory (not disk)
const storage = multer.memoryStorage();
const upload = multer({ 
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    // Accept only image files
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

// Helper function to upload to Vercel Blob
async function uploadToVercelBlob(file, folder, customName = null) {
  try {
    // Generate filename
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 8);
    const ext = path.extname(file.originalname);
    const fileName = customName ? 
      `${customName.replace(/[^a-zA-Z0-9-_]/g, '_')}${ext}` : 
      `${timestamp}-${randomString}${ext}`;
    
    // Create blob path
    const blobPath = `${folder}/${fileName}`;
    
    // Upload to Vercel Blob
    const blob = await put(blobPath, file.buffer, {
      access: 'public',
      contentType: file.mimetype,
    });
    
    return {
      url: blob.url,
      path: blobPath,
      filename: fileName,
      size: file.size,
      mimetype: file.mimetype
    };
  } catch (error) {
    console.error('Vercel Blob upload error:', error);
    throw new Error('Failed to upload to Vercel Blob');
  }
}

// Example route: Upload deck cover image
router.post('/:deckId/cover', upload.single('cover'), async (req, res) => {
  try {
    const { deckId } = req.params;
    
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    console.log(`Uploading deck cover for deck ${deckId}`);
    
    // Upload to Vercel Blob
    const result = await uploadToVercelBlob(req.file, `decks/${deckId}`, 'cover');
    
    // Update deck in database
    const Deck = require('../models/Deck');
    const deck = await Deck.findById(deckId);
    if (!deck) {
      return res.status(404).json({ error: 'Deck not found' });
    }
    
    deck.image = result.url;
    await deck.save();
    
    res.json({
      success: true,
      message: 'Deck cover uploaded successfully',
      url: result.url,
      filename: result.filename
    });
    
  } catch (error) {
    console.error('Deck cover upload error:', error);
    res.status(500).json({ 
      error: 'Upload failed', 
      message: error.message 
    });
  }
});

// Example route: Upload card image
router.post('/:deckId/cards/:cardName', upload.single('card'), async (req, res) => {
  try {
    const { deckId, cardName } = req.params;
    
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    console.log(`Uploading card image for ${cardName} in deck ${deckId}`);
    
    // Upload to Vercel Blob
    const result = await uploadToVercelBlob(req.file, `decks/${deckId}/cards`, cardName);
    
    // Update deck card in database
    const Deck = require('../models/Deck');
    const deck = await Deck.findById(deckId);
    if (!deck) {
      return res.status(404).json({ error: 'Deck not found' });
    }
    
    // Find and update the card
    const cardIndex = deck.cards.findIndex(c => c.name === cardName);
    if (cardIndex === -1) {
      // Add new card
      deck.cards.push({ name: cardName, image: result.url });
    } else {
      // Update existing card
      deck.cards[cardIndex].image = result.url;
    }
    
    await deck.save();
    
    res.json({
      success: true,
      message: 'Card image uploaded successfully',
      cardName: cardName,
      url: result.url,
      filename: result.filename
    });
    
  } catch (error) {
    console.error('Card image upload error:', error);
    res.status(500).json({ 
      error: 'Upload failed', 
      message: error.message 
    });
  }
});

// Example route: Upload multiple files at once
router.post('/:deckId/batch', upload.array('images', 10), async (req, res) => {
  try {
    const { deckId } = req.params;
    
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }
    
    console.log(`Batch uploading ${req.files.length} images for deck ${deckId}`);
    
    const results = [];
    
    // Upload each file to Vercel Blob
    for (const file of req.files) {
      try {
        const result = await uploadToVercelBlob(file, `decks/${deckId}/batch`);
        results.push({
          originalName: file.originalname,
          url: result.url,
          filename: result.filename,
          status: 'success'
        });
      } catch (error) {
        results.push({
          originalName: file.originalname,
          error: error.message,
          status: 'failed'
        });
      }
    }
    
    const successful = results.filter(r => r.status === 'success');
    const failed = results.filter(r => r.status === 'failed');
    
    res.json({
      success: true,
      message: `Batch upload completed: ${successful.length} successful, ${failed.length} failed`,
      results: results,
      summary: {
        total: req.files.length,
        successful: successful.length,
        failed: failed.length
      }
    });
    
  } catch (error) {
    console.error('Batch upload error:', error);
    res.status(500).json({ 
      error: 'Batch upload failed', 
      message: error.message 
    });
  }
});

// Example route: Upload profile picture (different folder)
router.post('/profile/upload', upload.single('avatar'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    console.log('Uploading profile picture');
    
    // Upload to Vercel Blob in profiles folder
    const result = await uploadToVercelBlob(req.file, 'profiles');
    
    // In a real app, you'd update the user's profile picture URL in database
    // const user = await User.findById(req.user.id);
    // user.profilePicture = result.url;
    // await user.save();
    
    res.json({
      success: true,
      message: 'Profile picture uploaded successfully',
      url: result.url,
      filename: result.filename
    });
    
  } catch (error) {
    console.error('Profile upload error:', error);
    res.status(500).json({ 
      error: 'Upload failed', 
      message: error.message 
    });
  }
});

module.exports = router;