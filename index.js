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
const os = require('os')
// Helper to detect serverless environment (Vercel, AWS Lambda, etc.)
const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.FUNCTIONS_WORKER_RUNTIME)

// Use safe uploads helper which will try to create project `uploads/`
// but fall back to a per-app tmpdir when the project folder is not writable
// (e.g. Vercel's /var/task). This avoids EROFS errors at module load time.
const { getUploadsDir } = require('./utils/uploads')
const uploadsDir = getUploadsDir()

// Only mount the static uploads route when running a persistent server
// (local / non-serverless). In serverless, uploads should be served from
// external storage or handled via direct uploads to a CDN/storage provider.
if (!isServerless) {
  try {
    app.use('/uploads', express.static(uploadsDir))
  } catch (err) {
    console.warn('Failed to mount uploads static route, skipping:', err && err.code)
  }
}

// (isServerless is declared above once)

// Use a centralized serverless-safe DB connection helper
const { connectToDatabase } = require('./utils/connectToDatabase')

// Run optional seeding only when explicitly enabled
async function runOptionalSeeding() {
  if (process.env.RUN_SEEDS !== 'true') return

  console.log('Running optional DB seeding (RUN_SEEDS=true)')

  try {
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

        const count = await Spread.countDocuments({})
        if (count === 0 && items.length) {
          const toInsert = items.map(it => ({
            spread: it.spread || '',
            cards: Array.isArray(it.cards) ? it.cards : [],
            image: it.image || ''
          }))
          await Spread.insertMany(toInsert)
          console.log(`🌱 Seeded ${toInsert.length} spreads into DB`)
        }
      }
    } catch (e) {
      console.error('Spreads seeding skipped:', e)
    }

    // Deck seeding
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
          const existingDeck = await Deck.findOne({ deckName: 'Rider-Waite Tarot Deck' })
          if (!existingDeck) {
            const riderWaiteDeck = new Deck({
              deckName: deckData.deckName,
              description: deckData.description,
              image: deckData.image,
              owner: null,
              cards: deckData.cards
            })
            await riderWaiteDeck.save()
            console.log(`🌱 Seeded Rider-Waite Tarot Deck with ${deckData.cards.length} cards into DB`)
          } else {
            console.log('📚 Rider-Waite Tarot Deck already exists in DB')
          }
        }
      }
    } catch (e) {
      console.error('Deck seeding skipped:', e)
    }

    // Global "Self" querent
    try {
      const Querent = require('./models/Querent')
      const existingSelfQuerent = await Querent.findOne({ name: 'Self', userId: null })
      if (!existingSelfQuerent) {
        const selfQuerent = new Querent({ name: 'Self', userId: null })
        await selfQuerent.save()
        console.log(`🌱 Seeded global "Self" querent into DB`)
      }
    } catch (e) {
      console.error('Self querent seeding skipped:', e)
    }

    // Global tags
    try {
      const Tag = require('./models/Tag')
      const globalTags = [
        'Career', 'Relationships', 'Finances', 'Romance', 'Health',
        'Friends & Family', 'Self-Reflection', 'Energy', 'Decision Making'
      ]
      for (const tagName of globalTags) {
        const existingTag = await Tag.findOne({ name: tagName, userId: null, isGlobal: true })
        if (!existingTag) {
          const globalTag = new Tag({ name: tagName, userId: null, isGlobal: true })
          await globalTag.save()
        }
      }
      console.log(`🌱 Seeded global tags into DB`)
    } catch (e) {
      console.error('Global tags seeding skipped:', e)
    }
  } catch (e) {
    console.error('Error during optional seeding:', e)
  }
}

// Initialize DB connection and optional seeding. In serverless environments
// we avoid exiting the process on failure and skip long-running tasks.
;(async () => {
  try {
    await connectToDatabase()
    console.log('✅ Connected to MongoDB Atlas')
    if (!isServerless || process.env.RUN_SEEDS === 'true') {
      await runOptionalSeeding()
    }
  } catch (error) {
    console.error('❌ MongoDB connection error:', error)
    if (!isServerless) process.exit(1)
  }
})()

// Middleware
// CORS configuration - allow a single origin or a comma-separated list.
// Normalize values (ensure scheme present) and validate request origins at runtime.
function normalizeOrigin(raw) {
  if (!raw) return null
  const trimmed = raw.trim()
  if (!trimmed) return null
  // allow comma-separated lists
  if (trimmed.includes(',')) return trimmed.split(',').map(s => normalizeOrigin(s)).filter(Boolean)
  // already has scheme
  if (/^https?:\/\//i.test(trimmed)) return trimmed.replace(/\/$/, '')
  // add https as default when missing
  return `https://${trimmed.replace(/\/$/, '')}`
}

const rawClient = process.env.CLIENT_URL || process.env.SERVER_URL || 'http://localhost:3000'
const normalized = normalizeOrigin(rawClient)
const allowedOrigins = Array.isArray(normalized) ? normalized : (normalized ? [normalized] : [])

// Compute allowed hostnames (strip www and normalize) for hostname matching
function hostnameOf(urlOrHost) {
  if (!urlOrHost) return null
  try {
    const u = new URL(urlOrHost)
    return (u.hostname || '').replace(/^www\./i, '').toLowerCase()
  } catch (e) {
    // value might already be a bare hostname like "example.com"
    return String(urlOrHost).replace(/^www\./i, '').toLowerCase()
  }
}

const allowedHostnames = allowedOrigins.map(hostnameOf).filter(Boolean)

const corsOptions = {
  origin: function (origin, callback) {
    // allow non-browser or same-origin requests with no origin (like Postman, curl)
    if (!origin) return callback(null, true)

    // direct exact match first (including scheme)
    if (allowedOrigins.indexOf(origin) !== -1) return callback(null, true)

    // try matching by hostname only (ignore scheme differences)
    let incomingHost
    try {
      incomingHost = new URL(origin).hostname.replace(/^www\./i, '').toLowerCase()
    } catch (e) {
      // malformed origin header - deny
      console.warn('CORS: malformed Origin header:', origin)
      return callback(new Error('CORS policy: Origin not allowed'), false)
    }

    if (allowedHostnames.indexOf(incomingHost) !== -1) {
      return callback(null, true)
    }

    // Not allowed - log for debugging and return an explicit error so the
    // request doesn't proceed. The framework will convert this into a 403/500
    // depending on the error handler; logging helps diagnose mismatched origins.
    console.warn('CORS blocked origin', origin, { allowedOrigins, allowedHostnames })
    return callback(new Error('CORS policy: Origin not allowed'), false)
  },
  credentials: true
}

app.use(cors(corsOptions))
// Ensure preflight (OPTIONS) requests always receive the CORS headers.
app.options('*', cors(corsOptions))
// Increase default JSON size limit so large requests don't get rejected by
// the global parser before route-specific parsers run. Keep this moderate
// and allow the export route to accept even bigger payloads.
app.use(express.json({ limit: '10mb' }))

// Session configuration (for Passport)
// Session configuration (for Passport)
// In production/serverless we should avoid the default MemoryStore which
// is not suitable for production. If `connect-mongo` is available and
// `MONGODB_URI` is configured, prefer a Mongo-backed session store.
const sessionOptions = {
  secret: process.env.SESSION_SECRET || 'your-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}

let mongoStoreAvailable = false
if (process.env.MONGODB_URI) {
  try {
    // connect-mongo v4 exports a `create` factory
    const MongoStore = require('connect-mongo')
    if (MongoStore && typeof MongoStore.create === 'function') {
      sessionOptions.store = MongoStore.create({ mongoUrl: process.env.MONGODB_URI })
      mongoStoreAvailable = true
    }
  } catch (e) {
    // connect-mongo not installed or failed - we'll fall back and warn
    console.warn('connect-mongo not available - using default MemoryStore. Install connect-mongo for production sessions.')
  }
}

if (!mongoStoreAvailable && process.env.NODE_ENV === 'production') {
  console.warn('Warning: connect.session() MemoryStore is not designed for a production environment, as it will leak memory, and will not scale past a single process.')
}

app.use(session(sessionOptions))

// Initialize Passport
app.use(passport.initialize())
app.use(passport.session())

// Routes
app.use('/api/auth', require('./routes/auth'))
app.use('/api/readings', require('./routes/readings'))
app.use('/api/querents', require('./routes/querents'))
app.use('/api/tags', require('./routes/tags'))
app.use('/api/health', require('./routes/health'))
// Debug endpoint: reports which critical environment variables are set.
// IMPORTANT: This endpoint intentionally does NOT return secret values.
// Use it only temporarily in deployment to verify environment parity.
app.get('/api/debug/env', (req, res) => {
  const keys = [
    'MONGODB_URI', 'JWT_SECRET', 'SESSION_SECRET', 'CLIENT_URL', 'SERVER_URL', 'NODE_ENV'
  ]
  const missing = []
  const present = []
  for (const k of keys) {
    if (process.env[k]) present.push(k)
    else missing.push(k)
  }
  res.json({ ok: missing.length === 0, present, missing })
})
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

// Lightweight root handler: redirect to the configured client URL when present,
// otherwise return a small JSON payload so `GET /` doesn't 404 during local
// development or quick checks.
app.get('/', (req, res) => {
  const clientUrl = process.env.CLIENT_URL && process.env.CLIENT_URL.trim()
  if (clientUrl) {
    return res.redirect(clientUrl)
  }
  return res.json({ status: 'ok', message: 'MyTarotReadings API is running' })
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

// Only start a persistent server when not running in serverless
if (!isServerless) {
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

  // Scheduled purge for soft-deleted accounts (only for long-running server)
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
}

// When running in serverless (Vercel), export the Express app so the platform
// can mount it. This prevents the 'No exports found' message when Vercel
// expects an exported function or app.
if (isServerless) {
  module.exports = app
}
