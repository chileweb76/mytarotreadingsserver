const express = require('express')
const router = express.Router()
const Reading = require('../models/Reading')
const mongoose = require('mongoose')
const multer = require('multer')
const path = require('path')
const fs = require('fs')
const passport = require('passport')

// Helper: parse client-sent date/time values robustly.
// If the client sends a timezone-less "YYYY-MM-DDTHH:mm" (typical from
// <input type="datetime-local">), browsers will often stringify it without
// a timezone. When Node's Date parses such a string it can be interpreted as
// UTC in some environments which shifts the stored time. To preserve the
// intended local wall-clock time, detect the pattern and construct a Date
// using local components.
function parseClientDate(value) {
  if (!value) return null
  if (value instanceof Date) return value
  if (typeof value !== 'string') {
    try { return new Date(value) } catch (e) { return null }
  }
  // ISO with timezone or trailing Z -> safe to parse normally
  if (/[zZ]|[+-]\d{2}:?\d{2}$/.test(value)) {
    return new Date(value)
  }
  // Match YYYY-MM-DDTHH:mm(:ss)? optionally
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/)
  if (m) {
    const [ , y, mo, d, hh, mm, ss ] = m
    const year = parseInt(y, 10), month = parseInt(mo, 10) - 1, day = parseInt(d, 10)
    const hour = parseInt(hh, 10), minute = parseInt(mm, 10), second = ss ? parseInt(ss,10) : 0
    return new Date(year, month, day, hour, minute, second)
  }
  // Fallback to default Date parsing
  return new Date(value)
}

// Multer setup for reading image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const { getUploadsDir } = require('../utils/uploads')
    const dest = getUploadsDir('readings')
    cb(null, dest)
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg'
    const safe = Date.now() + '-' + Math.random().toString(36).slice(2,8)
    cb(null, `${safe}${ext}`)
  }
})

// Disk-based upload (legacy / local dev)
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } }) // 5MB limit

// Memory-based upload for direct Vercel Blob streaming
const memoryUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } })

// Sample tarot cards data
const tarotCards = [
  { name: 'The Fool', meaning: 'new beginnings, spontaneity, innocence' },
  { name: 'The Magician', meaning: 'manifestation, resourcefulness, power' },
  { name: 'The High Priestess', meaning: 'intuition, sacred knowledge, divine feminine' },
  { name: 'The Empress', meaning: 'femininity, beauty, nature, abundance' },
  { name: 'The Emperor', meaning: 'authority, establishment, structure, father figure' },
  { name: 'The Hierophant', meaning: 'spiritual wisdom, religious beliefs, conformity' },
  { name: 'The Lovers', meaning: 'love, harmony, relationships, values alignment' },
  { name: 'The Chariot', meaning: 'control, willpower, success, determination' },
  { name: 'Strength', meaning: 'courage, persuasion, influence, compassion' },
  { name: 'The Hermit', meaning: 'soul searching, introspection, inner guidance' },
  { name: 'Wheel of Fortune', meaning: 'good luck, karma, life cycles, destiny' },
  { name: 'Justice', meaning: 'justice, fairness, truth, cause and effect' },
  { name: 'The Hanged Man', meaning: 'suspension, restriction, letting go' },
  { name: 'Death', meaning: 'endings, beginnings, change, transformation' },
  { name: 'Temperance', meaning: 'balance, moderation, patience, purpose' },
  { name: 'The Devil', meaning: 'bondage, addiction, sexuality, materialism' },
  { name: 'The Tower', meaning: 'sudden change, upheaval, chaos, revelation' },
  { name: 'The Star', meaning: 'hope, faith, purpose, renewal, spirituality' },
  { name: 'The Moon', meaning: 'illusion, fear, anxiety, subconscious, intuition' },
  { name: 'The Sun', meaning: 'positivity, fun, warmth, success, vitality' },
  { name: 'Judgement', meaning: 'judgement, rebirth, inner calling, absolution' },
  { name: 'The World', meaning: 'completion, accomplishment, travel, fulfillment' }
]

// GET /api/readings - Get a random tarot reading
router.get('/', async (req, res) => {
  try {
    // Shuffle and pick 3 random cards
    const shuffled = [...tarotCards].sort(() => 0.5 - Math.random())
    const selectedCards = shuffled.slice(0, 3)
    
    const reading = {
      cards: [
        {
          position: 'Past',
          name: selectedCards[0].name,
          meaning: selectedCards[0].meaning
        },
        {
          position: 'Present',
          name: selectedCards[1].name,
          meaning: selectedCards[1].meaning
        },
        {
          position: 'Future',
          name: selectedCards[2].name,
          meaning: selectedCards[2].meaning
        }
      ],
      spread: 'Three-Card Spread',
      timestamp: new Date().toISOString()
    }
    
    // Optionally save to MongoDB (if connection is available)
    try {
      const savedReading = new Reading(reading)
      await savedReading.save()
    } catch (mongoError) {
      // Continue even if save fails
    }
    
    res.json(reading)
  } catch (error) {
    console.error('Error generating reading:', error)
    res.status(500).json({ error: 'Failed to generate reading' })
  }
})

// GET /api/readings/history - Get reading history from MongoDB
router.get('/history', async (req, res) => {
  try {
    const readings = await Reading.find()
      .sort({ timestamp: -1 })
      .limit(10)
    
    res.json({
      count: readings.length,
      readings: readings
    })
  } catch (error) {
    console.error('Error fetching reading history:', error)
    res.status(500).json({ error: 'Failed to fetch reading history' })
  }
})

// Check authentication status
router.get('/auth/check', (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '')
  
  if (!token) {
    return res.status(401).json({ 
      authenticated: false, 
      message: 'No token provided' 
    })
  }
  
  // Verify token using passport JWT
  passport.authenticate('jwt', { session: false }, (err, user, info) => {
    if (err) {
      return res.status(500).json({ 
        authenticated: false, 
        message: 'Token verification error' 
      })
    }
    
    if (!user) {
      return res.status(401).json({ 
        authenticated: false, 
        message: info?.message || 'Invalid token' 
      })
    }
    
    res.json({ 
      authenticated: true, 
      user: { 
        id: user.id, 
        email: user.email, 
        name: user.name 
      } 
    })
  })(req, res)
})

// GET /api/readings/user - Get user's reading history (with proper JWT auth)
router.get('/user', passport.authenticate('jwt', { session: false }), async (req, res) => {
  try {
    const userId = req.user.id || req.user._id
    
    const readings = await Reading.find({ userId })
      .populate('querent', 'name')
      .populate('spread', 'spread')
      .populate('deck')
      .populate('selectedTags', 'name isGlobal')
      .sort({ dateTime: -1 })
    
    res.json({
      count: readings.length,
      readings: readings,
      user: {
        id: req.user._id,
        name: req.user.name,
        email: req.user.email
      }
    })
  } catch (error) {
    console.error('Error fetching user reading history:', error)
    res.status(500).json({ error: 'Failed to fetch reading history', details: error.message })
  }
})

// GET /api/readings/:id - Get a single reading by ID
router.get('/:id', passport.authenticate('jwt', { session: false }), async (req, res) => {
  try {
    const { id } = req.params
    const userId = req.user?.id || req.headers['x-user-id']
    
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' })
    }

    const reading = await Reading.findOne({ _id: id, userId })
      .populate('querent', 'name')
      .populate('spread', 'spread')
      .populate('deck')
      .populate('selectedTags', 'name isGlobal')
    
    if (!reading) {
      return res.status(404).json({ error: 'Reading not found' })
    }

    res.json({
      success: true,
      reading: reading
    })
  } catch (error) {
    console.error('Error fetching reading:', error)
    res.status(500).json({ error: 'Failed to fetch reading' })
  }
})

// PUT /api/readings/:id - Update a reading
router.put('/:id', passport.authenticate('jwt', { session: false }), async (req, res) => {
  try {
    const { id } = req.params
    // Accept additional writable fields on update so explicit Save persists everything
    const { question, interpretation, outcome, dateTime, drawnCards, image, querent, spread, deck, selectedTags } = req.body
    const userId = req.user?.id || req.headers['x-user-id']
  // Debug: log incoming update body
  try { require('../utils/log').debug('[readings PUT] id=', id, 'body=', req.body, 'headers x-user-id=', req.headers['x-user-id']) } catch (e) {}

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' })
    }

    // Find reading and verify ownership
    // sanitize id (trim possible whitespace/quotes) and attempt a resilient lookup
    const idSan = typeof id === 'string' ? id.trim().replace(/^"|"$/g, '') : id
    let reading = await Reading.findById(idSan)
    if (!reading) {
      // Try a fallback lookup in case id was provided as a stringified object or other form
      try {
        const maybe = String(idSan)
        reading = await Reading.findOne({ _id: maybe })
      } catch (e) {
        // ignore
      }
    }
    if (!reading) {
      return res.status(404).json({ error: 'Reading not found' })
    }

    if (reading.userId?.toString() !== userId) {
      return res.status(403).json({ error: 'Not authorized to edit this reading' })
    }

    // Update reading - merge drawnCards where possible instead of blind replace

    // Resolve querent for updates similar to POST: accept 'self', ObjectId string, object with _id/id, or name lookup
    let resolvedQuerentForUpdate = undefined
    if (typeof querent !== 'undefined') {
      try {
        const incomingQuerent = (typeof querent === 'string' && querent.trim() === '') ? 'self' : querent
        const Querent = require('../models/Querent')
        if (typeof incomingQuerent === 'string') {
          if (incomingQuerent === 'self') {
            // Find or create a global "Self" querent that all users can reference
            let selfQuerent = await Querent.findOne({ name: 'Self', userId: null })
            if (!selfQuerent) {
              selfQuerent = new Querent({ name: 'Self', userId: null })
              await selfQuerent.save()
              try { require('../utils/log').debug('[readings PUT] created global Self querent') } catch (e) {}
            }
            resolvedQuerentForUpdate = selfQuerent._id
          } else if (mongoose.Types.ObjectId.isValid(incomingQuerent)) {
            resolvedQuerentForUpdate = new mongoose.Types.ObjectId(incomingQuerent)
          } else {
            const found = await Querent.findOne({ name: incomingQuerent, userId: reading.userId })
            resolvedQuerentForUpdate = found ? found._id : null
          }
        } else if (typeof incomingQuerent === 'object') {
          if (incomingQuerent._id) resolvedQuerentForUpdate = new mongoose.Types.ObjectId(String(incomingQuerent._id))
          else if (incomingQuerent.id) resolvedQuerentForUpdate = new mongoose.Types.ObjectId(String(incomingQuerent.id))
          else if (incomingQuerent.name) {
            const found = await Querent.findOne({ name: incomingQuerent.name, userId: reading.userId })
            resolvedQuerentForUpdate = found ? found._id : null
          }
        }
      } catch (e) {
        console.warn('[readings PUT] querent resolution failed:', e && e.message)
        // fall back to keeping existing if resolution fails
        resolvedQuerentForUpdate = reading.querent
      }
      // Additional guard: if the client sent the default 'self' (UI default) but the reading
      // already has a querent (non-null), assume the client didn't intend to change it and
      // preserve the existing querent. This prevents accidental overwrite when the
      // frontend includes its default value in the update payload.
      // NOTE: Now that 'self' creates a global Self querent, this guard checks if existing
      // querent is already the global Self querent.
      try {
        if (typeof querent === 'string' && querent === 'self' && reading.querent) {
          // Check if the existing querent is already the global "Self" querent
          const existingQuerent = await Querent.findById(reading.querent)
          if (existingQuerent && existingQuerent.name === 'Self' && existingQuerent.userId === null) {
            // Already has global Self querent, keep it
            resolvedQuerentForUpdate = reading.querent
          } else {
            // Has a different querent, but client sent 'self' - this might be intentional
            // so proceed with using the global Self querent as resolved above
          }
        }
      } catch (e) {
        // ignore
      }
    }

    const update = {
      question: typeof question !== 'undefined' ? question : reading.question,
      interpretation: typeof interpretation !== 'undefined' ? interpretation : reading.interpretation,
      outcome: typeof outcome !== 'undefined' ? outcome : reading.outcome,
      dateTime: dateTime ? parseClientDate(dateTime) : reading.dateTime,
      // allow changing querent/spread/deck on explicit save
      querent: typeof querent !== 'undefined' ? resolvedQuerentForUpdate : reading.querent,
      spread: typeof spread !== 'undefined' ? (spread || null) : reading.spread,
      deck: typeof deck !== 'undefined' ? (deck || null) : reading.deck,
      selectedTags: typeof selectedTags !== 'undefined' ? selectedTags : reading.selectedTags
    }

    // Merge drawnCards: prefer matching by title, fallback to index position
    if (typeof drawnCards !== 'undefined' && Array.isArray(drawnCards)) {
      const existing = Array.isArray(reading.drawnCards) ? reading.drawnCards.map(dc => ({
        title: dc.title,
        suit: dc.suit,
        card: dc.card,
        reversed: dc.reversed,
        interpretation: dc.interpretation,
        image: dc.image
      })) : []

      const merged = drawnCards.map((incoming, idx) => {
        // find by title (case-insensitive)
        const foundIdx = existing.findIndex(e => (e.title || '').toLowerCase() === (incoming.title || '').toLowerCase())
        const base = foundIdx !== -1 ? existing[foundIdx] : (existing[idx] || {})
        return {
          title: incoming.title || base.title || '',
          suit: typeof incoming.suit !== 'undefined' ? incoming.suit : base.suit || '',
          card: typeof incoming.card !== 'undefined' ? incoming.card : base.card || '',
          reversed: typeof incoming.reversed !== 'undefined' ? !!incoming.reversed : !!base.reversed,
          interpretation: typeof incoming.interpretation !== 'undefined' ? incoming.interpretation : (base.interpretation || ''),
          image: typeof incoming.image !== 'undefined' ? incoming.image : (base.image || null)
        }
      })
      update.drawnCards = merged
    }

    if (typeof image !== 'undefined' && image) update.image = image

    const updatedReading = await Reading.findByIdAndUpdate(
      id,
      update,
      { new: true }
    ).populate('querent', 'name')
     .populate('spread', 'spread')
     .populate('deck', 'deckName')
     .populate('selectedTags', 'name isGlobal')

    res.json({
      success: true,
      reading: updatedReading
    })
  } catch (error) {
    console.error('Error updating reading:', error)
    res.status(500).json({ error: 'Failed to update reading' })
  }
})

// DELETE /api/readings/:id - Delete a reading
router.delete('/:id', passport.authenticate('jwt', { session: false }), async (req, res) => {
  try {
    const { id } = req.params
    const userId = req.user?.id || req.headers['x-user-id']

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' })
    }

    // Find reading and verify ownership
    const reading = await Reading.findById(id)
    if (!reading) {
      return res.status(404).json({ error: 'Reading not found' })
    }

    if (reading.userId?.toString() !== userId) {
      return res.status(403).json({ error: 'Not authorized to delete this reading' })
    }

    await Reading.findByIdAndDelete(id)

    res.json({
      success: true,
      message: 'Reading deleted successfully'
    })
  } catch (error) {
    console.error('Error deleting reading:', error)
    res.status(500).json({ error: 'Failed to delete reading' })
  }
})

// POST /api/readings - Save a new reading
router.post('/', async (req, res) => {
  try {
    const {
      querent,
      spread,
      image,
      question,
      deck,
      dateTime,
      drawnCards,
      interpretation,
      selectedTags,
      userId
    } = req.body

    // Validate required fields
    if (!dateTime) {
      return res.status(400).json({ error: 'dateTime is required' })
    }

  // Prefer authenticated user id if available (passport may have set req.user)
  const effectiveUserId = (req.user && (req.user.id || req.user._id)) || userId || req.headers['x-user-id'] || null
  const effectiveUserIdStr = effectiveUserId ? String(effectiveUserId) : null

    // Debug: log full body and effective user for troubleshooting
    try {
      require('../utils/log').debug('[readings POST] body:', req.body)
      require('../utils/log').debug('[readings POST] headers x-user-id:', req.headers['x-user-id'], 'effectiveUserId:', effectiveUserId)
    } catch (e) { /* ignore */ }

    // For debugging: list querents that exist for this effective user so we can
    // compare what the frontend is sending vs what the DB contains.
    if (effectiveUserIdStr) {
      try {
        const Querent = require('../models/Querent')
        const qlist = await Querent.find({ userId: effectiveUserIdStr }).select('_id name').lean()
  try { require('../utils/log').debug('[readings POST] querents for effectiveUserId:', effectiveUserIdStr, qlist.map(q => ({ _id: String(q._id), name: q.name }))) } catch (e) {}
      } catch (e) {
  try { require('../utils/log').debug('[readings POST] failed to list querents for user:', e && e.message) } catch (e) {}
      }
    }

    // Resolve querent into an ObjectId. Accept multiple shapes from the client:
    // - the string 'self' => find or create a "Self" querent for this user
    // - a 24-hex string (ObjectId) => use as-is
    // - an object with _id or id property => use that
    // - a querent name string => try to lookup the Querent by name for this user
    // normalize empty-string querent to 'self' (treat as self querent)
    const incomingQuerent = (typeof querent === 'string' && querent.trim() === '') ? 'self' : querent

    let resolvedQuerent = null
    try {
      const Querent = require('../models/Querent')
      if (typeof incomingQuerent !== 'undefined' && incomingQuerent !== null) {
        if (typeof incomingQuerent === 'string') {
          if (incomingQuerent === 'self') {
            // Find or create a global "Self" querent that all users can reference
            let selfQuerent = await Querent.findOne({ name: 'Self', userId: null })
            if (!selfQuerent) {
              selfQuerent = new Querent({ name: 'Self', userId: null })
              await selfQuerent.save()
              try { require('../utils/log').debug('[readings POST] created global Self querent') } catch (e) {}
            }
            resolvedQuerent = selfQuerent._id
          } else if (mongoose.Types.ObjectId.isValid(incomingQuerent)) {
            resolvedQuerent = incomingQuerent
          } else {
            // treat as name and try to find matching querent for this user
            try {
              const found = await Querent.findOne({ name: incomingQuerent, userId: effectiveUserIdStr })
              if (found) resolvedQuerent = found._id
              else resolvedQuerent = null
            } catch (e) {
              resolvedQuerent = null
            }
          }
        } else if (typeof incomingQuerent === 'object') {
          if (incomingQuerent._id) resolvedQuerent = incomingQuerent._id
          else if (incomingQuerent.id) resolvedQuerent = incomingQuerent.id
          else if (incomingQuerent.name) {
            try {
              const found = await Querent.findOne({ name: incomingQuerent.name, userId: effectiveUserIdStr })
              if (found) resolvedQuerent = found._id
              else resolvedQuerent = null
            } catch (e) {
              resolvedQuerent = null
            }
          }
        }
      }
      } catch (e) {
        resolvedQuerent = null
      }    // Debug: log incoming querent and resolved result to help diagnose unexpected nulls
    try {
      require('../utils/log').debug('[readings POST] incoming querent:', { rawQuerent: querent, type: typeof querent })
      require('../utils/log').debug('[readings POST] resolvedQuerent before coercion:', { resolvedQuerent, effectiveUserId })
    } catch (e) { /* ignore logging errors */ }

    // Coerce resolvedQuerent to an ObjectId when appropriate to avoid Mongoose casting issues
    let querentToSave = null
    if (typeof resolvedQuerent === 'string' && mongoose.Types.ObjectId.isValid(resolvedQuerent)) {
      try {
        querentToSave = new mongoose.Types.ObjectId(resolvedQuerent)
      } catch (e) {
        querentToSave = resolvedQuerent
      }
    } else if (resolvedQuerent && typeof resolvedQuerent === 'object' && resolvedQuerent._id && mongoose.Types.ObjectId.isValid(String(resolvedQuerent._id))) {
      querentToSave = new mongoose.Types.ObjectId(String(resolvedQuerent._id))
    } else if (resolvedQuerent && mongoose.Types.ObjectId.isValid(String(resolvedQuerent))) {
      querentToSave = new mongoose.Types.ObjectId(String(resolvedQuerent))
    } else {
      querentToSave = resolvedQuerent
    }

    // If the client explicitly provided a querent (not undefined) and it wasn't 'self',
    // but we couldn't resolve it to a valid Querent, reject the request rather than silently saving null.
    const clientProvidedQuerent = typeof querent !== 'undefined' && querent !== null
    const clientQuerentIsSelf = (typeof querent === 'string' && (querent === 'self' || querent.trim() === ''))
    if (clientProvidedQuerent && !clientQuerentIsSelf && (querentToSave === null)) {
      return res.status(400).json({ error: 'Querent could not be resolved. Please select a valid querent or choose Self.' })
    }

    // Create new reading
    const reading = new Reading({
      querent: querentToSave,
      spread: spread || null,
      image: image || null,
      question: question || '',
      deck: deck || null,
      dateTime: parseClientDate(dateTime),
      drawnCards: Array.isArray(drawnCards) ? drawnCards : (drawnCards ? [drawnCards] : []),
      interpretation: interpretation || '',
      selectedTags: Array.isArray(selectedTags) ? selectedTags : [],
      userId: effectiveUserId || null
    })

    const savedReading = await reading.save()
    // Load with populated querent/spread/deck for clarity in the response
    const populated = await Reading.findById(savedReading._id)
      .populate('querent', 'name')
      .populate('spread', 'spread')
      .populate('deck', 'deckName')
      .populate('selectedTags', 'name isGlobal')

    res.status(201).json({
      success: true,
      reading: populated
    })
  } catch (error) {
    console.error('Error saving reading:', error)
    res.status(500).json({ error: 'Failed to save reading', details: error.message })
  }
})

// Upload a reading image (auth optional but recommended) -> returns web-accessible URL
router.post('/:id/image', passport.authenticate('jwt', { session: false }), upload.single('image'), async (req, res) => {
  try {
    const { id } = req.params
    if (!id) return res.status(400).json({ error: 'Reading id is required' })
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' })

    let reading
    try {
      reading = await Reading.findById(id)
    } catch (err) {
      return res.status(400).json({ error: 'Invalid reading id' })
    }
    if (!reading) return res.status(404).json({ error: 'Reading not found' })

    // Ensure ownership if reading has userId
    const userId = req.user && (req.user.id || req.user._id)
    if (reading.userId && reading.userId.toString() !== String(userId)) {
      return res.status(403).json({ error: 'Not authorized to upload image for this reading' })
    }

    // If Vercel Blob is configured, prefer streaming the file to blob storage
    const VERCEL_BLOB_TOKEN = process.env.VERCEL_BLOB_TOKEN || process.env.VERCEL_STORAGE_TOKEN
    if (VERCEL_BLOB_TOKEN && req.file && req.file.buffer) {
      try {
        const { put } = require('@vercel/blob')
        const timestamp = Date.now()
        const ext = path.extname(req.file.originalname) || '.jpg'
        const blobPath = `readings/${reading._id}/${timestamp}${ext}`
        const blob = await put(blobPath, req.file.buffer, { access: 'public', contentType: req.file.mimetype })
        reading.image = blob.url
        await reading.save()
        return res.json({ success: true, image: blob.url, blob: blob })
      } catch (err) {
        // fall through to disk fallback
      }
    }

    const { buildServerBase } = require('../utils/serverBase')
    const webPath = `${buildServerBase(req)}/uploads/readings/${req.file.filename}`
    reading.image = webPath
    await reading.save()
    res.json({ success: true, image: webPath })
  } catch (err) {
    console.error('Reading image upload error', err)
    res.status(500).json({ error: 'Upload failed' })
  }
})

// Alias route for blob upload (if frontend expects this endpoint) - no auth required for testing
router.post('/:id/blob/upload', memoryUpload.single('image'), async (req, res) => {
  try {
    const { id } = req.params
    
    if (!id) return res.status(400).json({ error: 'Reading id is required' })
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' })

    let reading
    try {
      reading = await Reading.findById(id)
    } catch (err) {
      return res.status(400).json({ error: 'Invalid reading id' })
    }
    if (!reading) return res.status(404).json({ error: 'Reading not found' })

    // If Vercel Blob configured, upload the in-memory buffer directly
    const VERCEL_BLOB_TOKEN = process.env.VERCEL_BLOB_TOKEN || process.env.VERCEL_STORAGE_TOKEN
    
    if (VERCEL_BLOB_TOKEN && req.file && req.file.buffer) {
      try {
        const { put } = require('@vercel/blob')
        const ext = path.extname(req.file.originalname) || '.jpg'
        const fileName = `${Date.now()}-${Math.random().toString(36).slice(2,8)}${ext}`
        const blobPath = `readings/${id}/${fileName}`
        const blob = await put(blobPath, req.file.buffer, { access: 'public', contentType: req.file.mimetype })
        reading.image = blob.url
        await reading.save()
        return res.json({ success: true, image: blob.url, url: blob.url, blob })
      } catch (err) {
        // fall through to disk fallback
      }
    }

    const { buildServerBase } = require('../utils/serverBase')
    const webPath = `${buildServerBase(req)}/uploads/readings/${req.file.filename}`
    reading.image = webPath
    await reading.save()
    
    res.json({ success: true, image: webPath, url: webPath })
  } catch (err) {
    console.error('Reading blob upload error', err)
    res.status(500).json({ error: 'Blob upload failed', details: err.message })
  }
})

module.exports = router
