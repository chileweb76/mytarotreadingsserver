const express = require('express')
const cors = require('cors')
const dotenv = require('dotenv')
const path = require('path')

// Load environment variables from server/.env explicitly so running from
// project root picks up the server env values reliably.
dotenv.config({ path: path.resolve(__dirname, '.env') })

const mongoose = require('mongoose')
const session = require('express-session')
const passport = require('./config/passport')

const app = express()

const fs = require('fs')

// Ensure uploads directory exists and serve it statically
const uploadsDir = path.join(__dirname, 'uploads')
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir)
}
app.use('/uploads', express.static(uploadsDir))

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('✅ Connected to MongoDB Atlas')
    // Seed spreads collection from client/public/spreads.json if empty
    try {
      const Spread = require('./models/Spread')
      const spreadsPath = path.join(__dirname, '..', 'client', 'public', 'spreads.json')
      if (fs.existsSync(spreadsPath)) {
        const raw = fs.readFileSync(spreadsPath, 'utf8')
        let items = []
        try {
          items = JSON.parse(raw)
        } catch (e) {
          console.error('Failed to parse spreads.json', e)
          items = []
        }

        ;(async () => {
          try {
            const count = await Spread.countDocuments({})
            if (count === 0 && items.length) {
              // normalize items to model shape
              const toInsert = items.map(it => ({
                spread: it.spread || '',
                cards: Array.isArray(it.cards) ? it.cards : [],
                image: it.image || ''
              }))
              await Spread.insertMany(toInsert)
              console.log(`🌱 Seeded ${toInsert.length} spreads into DB`)
            }
          } catch (e) {
            console.error('Error seeding spreads', e)
          }
        })()
      }
    } catch (e) {
      console.error('Spreads seeding skipped:', e)
    }

    // Seed decks collection from rider_waite.json if Rider-Waite deck doesn't exist
    try {
      const Deck = require('./models/Deck')
      const riderWaitePath = path.join(__dirname, '..', 'rider_waite.json')
      if (fs.existsSync(riderWaitePath)) {
        const raw = fs.readFileSync(riderWaitePath, 'utf8')
        let deckData = null
        try {
          deckData = JSON.parse(raw)
        } catch (e) {
          console.error('Failed to parse rider_waite.json', e)
        }

        if (deckData) {
          ;(async () => {
            try {
              // Check if Rider-Waite deck already exists
              const existingDeck = await Deck.findOne({ deckName: 'Rider-Waite Tarot Deck' })
              if (!existingDeck) {
                // Create the deck (owner: null means it's available to all users)
                const riderWaiteDeck = new Deck({
                  deckName: deckData.deckName,
                  description: deckData.description,
                  image: deckData.image, // Include deck cover image
                  owner: null, // Available to all users
                  cards: deckData.cards
                })
                await riderWaiteDeck.save()
                console.log(`🌱 Seeded Rider-Waite Tarot Deck with ${deckData.cards.length} cards into DB`)
              } else {
                console.log('📚 Rider-Waite Tarot Deck already exists in DB')
              }
            } catch (e) {
              console.error('Error seeding Rider-Waite deck', e)
            }
          })()
        }
      }
    } catch (e) {
      console.error('Deck seeding skipped:', e)
    }

    // Seed a global "Self" querent that all users can reference
    try {
      const Querent = require('./models/Querent')
      ;(async () => {
        try {
          // Check if global "Self" querent already exists
          const existingSelfQuerent = await Querent.findOne({ name: 'Self', userId: null })
          if (!existingSelfQuerent) {
            // Create the global "Self" querent (userId: null means it's available to all users)
            const selfQuerent = new Querent({
              name: 'Self',
              userId: null // Global querent for all users
            })
            await selfQuerent.save()
            console.log(`🌱 Seeded global "Self" querent into DB`)
          } else {
            console.log('📚 Global "Self" querent already exists in DB')
          }
        } catch (e) {
          console.error('Error seeding global Self querent', e)
        }
      })()
    } catch (e) {
      console.error('Self querent seeding skipped:', e)
    }

    // Seed global tags for all users
    try {
      const Tag = require('./models/Tag')
      const globalTags = [
        'Career', 'Relationships', 'Finances', 'Romance', 'Health', 
        'Friends & Family', 'Self-Reflection', 'Energy', 'Decision Making'
      ]
      
      ;(async () => {
        try {
          for (const tagName of globalTags) {
            const existingTag = await Tag.findOne({ name: tagName, userId: null, isGlobal: true })
            if (!existingTag) {
              const globalTag = new Tag({
                name: tagName,
                userId: null, // Global tag for all users
                isGlobal: true
              })
              await globalTag.save()
            }
          }
          console.log(`🌱 Seeded global tags into DB`)
        } catch (e) {
          console.error('Error seeding global tags', e)
        }
      })()
    } catch (e) {
      console.error('Global tags seeding skipped:', e)
    }
  })
  .catch((error) => {
    console.error('❌ MongoDB connection error:', error)
    process.exit(1)
  })

// Middleware
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true
}))
// Increase default JSON size limit so large requests don't get rejected by
// the global parser before route-specific parsers run. Keep this moderate
// and allow the export route to accept even bigger payloads.
app.use(express.json({ limit: '10mb' }))

// Session configuration (for Passport)
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}))

// Initialize Passport
app.use(passport.initialize())
app.use(passport.session())

// Routes
app.use('/api/auth', require('./routes/auth'))
app.use('/api/readings', require('./routes/readings'))
app.use('/api/querents', require('./routes/querents'))
app.use('/api/tags', require('./routes/tags'))
app.use('/api/health', require('./routes/health'))
app.use('/api/decks', require('./routes/decks'))
app.use('/api/spreads', require('./routes/spreads'))
app.use('/api/card-image', require('./routes/card-image'))
// Server-side PDF export endpoint
// Allow larger JSON payloads on this route because clients may POST full-page
// HTML with inlined base64 images (canvas data URLs). Default express.json
// limit is too small and will throw PayloadTooLargeError for those requests.
app.use('/api/export', express.json({ limit: '50mb' }), require('./routes/export-pdf'))
// Insights endpoints
app.use('/api/insights', require('./routes/insights'))

// Backwards-compatible redirect: some emails may contain /auth/verify (no /api/)
// Redirect those to the API verify endpoint so legacy links don't 404.
app.get('/auth/verify', (req, res) => {
  const token = req.query.token || ''
  if (!token) return res.status(400).json({ error: 'Token is required' })
  return res.redirect(`/api/auth/verify?token=${encodeURIComponent(token)}`)
})

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack)
  res.status(500).json({ error: 'Something went wrong!' })
})

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' })
})

const PORT = Number(process.env.PORT) || 5000

// Smart port selection - try multiple ports if needed
function startServer(port) {
  const server = app.listen(port, () => {
    console.log(`🚀 Server running on http://localhost:${port}`)
  })
  
  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`Port ${port} is busy, trying ${port + 1}...`)
      startServer(port + 1)
    } else {
      console.error('Server error:', err)
      process.exit(1)
    }
  })
}

startServer(PORT)

// Scheduled purge for soft-deleted accounts
const SOFT_DELETE_RETENTION_DAYS = Number(process.env.SOFT_DELETE_RETENTION_DAYS || 30)
const purgeIntervalMs = 24 * 60 * 60 * 1000 // daily

const purgeSoftDeletedAccounts = async () => {
  try {
    const cutoff = new Date(Date.now() - SOFT_DELETE_RETENTION_DAYS * 24 * 60 * 60 * 1000)
    const User = require('./models/User')
    const Reading = require('./models/Reading')

    // 1) Notify users whose deletion is coming up within NOTIFY_DAYS_BEFORE_PURGE and not yet notified
    const NOTIFY_DAYS_BEFORE_PURGE = Number(process.env.NOTIFY_DAYS_BEFORE_PURGE || 7)
    const now = new Date()
    const notifyCutoffStart = new Date(now.getTime() - 1000) // now
    const notifyCutoffEnd = new Date(now.getTime() + NOTIFY_DAYS_BEFORE_PURGE * 24 * 60 * 60 * 1000)

    const notificationTemplate = process.env.COURIER_NOTIFICATION_TEMPLATE_ID || process.env.COURIER_TEMPLATE_ID

    // Initial notifications (e.g., 7 days before purge)
    const usersToNotify = await User.find({
      isDeleted: true,
      deletedAt: { $exists: true, $ne: null },
      deletionNotified: false,
      deletedAt: { $lt: notifyCutoffEnd }
    })

    for (const user of usersToNotify) {
      try {
        if (!process.env.COURIER_AUTH_TOKEN || !notificationTemplate) continue
        const serverBase = process.env.CLIENT_URL || `http://localhost:${PORT}`
        const retentionDays = SOFT_DELETE_RETENTION_DAYS
        const purgeDate = new Date(user.deletedAt.getTime() + retentionDays * 24 * 60 * 60 * 1000)
        const payload = {
          message: {
            to: { email: user.email },
            template: notificationTemplate,
            data: {
              username: user.username,
              purge_date: purgeDate.toISOString(),
              days_left: Math.ceil((purgeDate - now) / (24 * 60 * 60 * 1000)),
              cancel_url: `${serverBase}/settings`,
              reminder_type: 'initial'
            }
          }
        }

        console.debug('Sending soft-delete initial notification to Courier:', { to: user.email, template: notificationTemplate })
        await fetch('https://api.courier.com/send', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.COURIER_AUTH_TOKEN}`
          },
          body: JSON.stringify(payload)
        })

        user.deletionNotified = true
        user.deletionNotificationSentAt = new Date()
        await user.save()
      } catch (err) {
        console.error('Failed to send deletion notification for user', user._id, err)
      }
    }

    // Final notifications (e.g., 1 day before purge)
    const FINAL_NOTIFY_DAYS = 1
    const finalCutoffEnd = new Date(now.getTime() + FINAL_NOTIFY_DAYS * 24 * 60 * 60 * 1000)
    const usersToFinalNotify = await User.find({
      isDeleted: true,
      deletedAt: { $exists: true, $ne: null },
      deletionFinalNotified: false,
      deletedAt: { $lt: finalCutoffEnd }
    })

    for (const user of usersToFinalNotify) {
      try {
        if (!process.env.COURIER_AUTH_TOKEN || !notificationTemplate) continue
        const serverBase = process.env.CLIENT_URL || `http://localhost:${PORT}`
        const retentionDays = SOFT_DELETE_RETENTION_DAYS
        const purgeDate = new Date(user.deletedAt.getTime() + retentionDays * 24 * 60 * 60 * 1000)
        const payload = {
          message: {
            to: { email: user.email },
            template: notificationTemplate,
            data: {
              username: user.username,
              purge_date: purgeDate.toISOString(),
              days_left: Math.ceil((purgeDate - now) / (24 * 60 * 60 * 1000)),
              cancel_url: `${serverBase}/settings`,
              reminder_type: 'final'
            }
          }
        }

        console.debug('Sending soft-delete final notification to Courier:', { to: user.email, template: notificationTemplate })
        await fetch('https://api.courier.com/send', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.COURIER_AUTH_TOKEN}`
          },
          body: JSON.stringify(payload)
        })

        user.deletionFinalNotified = true
        await user.save()
      } catch (err) {
        console.error('Failed to send final deletion notification for user', user._id, err)
      }
    }

    // 2) Permanently purge users past the cutoff
    const usersToPurge = await User.find({ isDeleted: true, deletedAt: { $lt: cutoff } })
    for (const user of usersToPurge) {
      await Reading.deleteMany({ userId: user._id.toString() })
      // remove custom spreads created by this user
      try {
        const Spread = require('./models/Spread')
        await Spread.deleteMany({ owner: user._id })
      } catch (e) {
        console.warn('Failed to delete spreads for user', user._id, e)
      }
      await User.findByIdAndDelete(user._id)
      console.log(`Purged soft-deleted user ${user._id}`)
    }
  } catch (err) {
    console.error('Error during soft-delete purge:', err)
  }
}

// Run on start and every 24h
purgeSoftDeletedAccounts()
setInterval(purgeSoftDeletedAccounts, purgeIntervalMs)
