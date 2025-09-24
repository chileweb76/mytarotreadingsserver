// Updated deck upload route using Vercel Blob instead of local storage

const multer = require('multer');
const { put } = require('@vercel/blob');
const path = require('path');

// Use memory storage instead of disk storage
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

// Upload a deck cover image or card image
router.post('/:deckId/upload', upload.single('image'), async (req, res) => {
  try {
    const { deckId } = req.params;
    const { cardName } = req.body; // Check if this is a card upload
    
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    
    const deck = await Deck.findById(deckId);
    if (!deck) return res.status(404).json({ error: 'Deck not found' });

    // Check if this is the Rider-Waite deck - prevent editing
    if (deck.deckName === 'Rider-Waite Tarot Deck') {
      return res.status(403).json({ error: 'Rider-Waite Tarot cards cannot be edited' });
    }

    // Prepare blob upload
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 8);
    const ext = path.extname(req.file.originalname);
    
    let blobPath, fileName;
    
    if (cardName) {
      // This is a card upload
      fileName = `${cardName.replace(/[^a-zA-Z0-9-_]/g, '_')}_${timestamp}${ext}`;
      blobPath = `decks/${deckId}/cards/${fileName}`;
    } else {
      // This is a deck cover upload
      fileName = `cover_${timestamp}${ext}`;
      blobPath = `decks/${deckId}/${fileName}`;
    }
    
    console.log(`Uploading ${cardName ? 'card' : 'deck cover'} to blob: ${blobPath}`);
    
    // Upload to Vercel Blob
    const blob = await put(blobPath, req.file.buffer, {
      access: 'public',
      contentType: req.file.mimetype,
    });
    
    console.log(`✅ Uploaded to Vercel Blob: ${blob.url}`);
    
    if (cardName) {
      // Update card image
      const card = deck.cards.find(c => (c.name || '').toLowerCase() === (cardName || '').toLowerCase());
      if (card) {
        card.image = blob.url;
      } else {
        // If not found, push new card
        deck.cards.push({ name: cardName, image: blob.url });
      }
      await deck.save();
      res.json({ 
        success: true, 
        card: card || deck.cards[deck.cards.length - 1],
        blobUrl: blob.url
      });
    } else {
      // Update deck cover image
      deck.image = blob.url;
      await deck.save();
      res.json({ 
        success: true, 
        deck: { 
          _id: deck._id, 
          deckName: deck.deckName, 
          image: deck.image 
        },
        blobUrl: blob.url
      });
    }
    
  } catch (err) {
    console.error('Vercel Blob upload error:', err);
    res.status(500).json({ 
      error: 'Upload failed', 
      message: err.message 
    });
  }
});

module.exports = router;