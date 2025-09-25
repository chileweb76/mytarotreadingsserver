const express = require('express')
const path = require('path')
const fs = require('fs')
const router = express.Router()

// GET /api/blob-mapping
// Returns the frontend's blob-url-mapping.json if present. This is intended
// for runtime verification/debugging so the client can confirm which static
// asset paths have been migrated to Vercel Blob URLs.
router.get('/', (req, res) => {
  try {
    // Admin token protection: if BLOB_MAPPING_ADMIN_TOKEN is set in the
    // environment, require a matching token via one of: `x-admin-token` header,
    // `Authorization: Bearer <token>`, or `?token=` query param. In production
    // this should be set to avoid publicly exposing internal mapping files.
    const adminTokenEnv = process.env.BLOB_MAPPING_ADMIN_TOKEN
    if (adminTokenEnv) {
      const headerToken = req.headers['x-admin-token']
      const authHeader = req.headers['authorization'] || req.headers['Authorization']
      const bearer = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null
      const queryToken = req.query && req.query.token ? String(req.query.token) : null
      const provided = headerToken || bearer || queryToken || null
      if (!provided || provided !== adminTokenEnv) {
        return res.status(403).json({ ok: false, message: 'Forbidden: valid admin token is required to access blob mapping' })
      }
    } else if (process.env.NODE_ENV === 'production') {
      // In production, require the admin token to be explicitly configured to
      // avoid accidental exposure of internal mapping files.
      return res.status(403).json({ ok: false, message: 'Forbidden: server is in production and BLOB_MAPPING_ADMIN_TOKEN is not configured' })
    }
    // The frontend keeps blob-url-mapping.json at the project root of the
    // client repo; when the server is deployed together with the client, the
    // mapping may be available relative to the server repo root. Try both
    // locations for robustness.
    const candidatePaths = [
      path.join(__dirname, '..', '..', 'mytarotreadings', 'blob-url-mapping.json'),
      path.join(__dirname, '..', '..', 'client', 'blob-url-mapping.json'),
      path.join(__dirname, '..', 'blob-url-mapping.json'),
      path.join(process.cwd(), 'blob-url-mapping.json')
    ]

    let found = null
    for (const p of candidatePaths) {
      if (fs.existsSync(p)) {
        found = p
        break
      }
    }

    if (!found) {
      return res.status(404).json({ ok: false, message: 'blob-url-mapping.json not found on server' })
    }

    const raw = fs.readFileSync(found, 'utf8')
    let parsed = null
    try {
      parsed = JSON.parse(raw)
    } catch (err) {
      return res.status(500).json({ ok: false, message: 'Failed to parse blob-url-mapping.json', details: err.message })
    }

    // Set caching headers to reduce load; mapping changes only when migration
    // scripts are run. Allow short caching in development and longer in prod.
    const maxAge = process.env.NODE_ENV === 'production' ? 60 * 60 : 15 // seconds
    res.setHeader('Cache-Control', `public, max-age=${maxAge}`)

    return res.json({ ok: true, mapping: parsed })
  } catch (err) {
    console.error('Error serving blob mapping:', err)
    return res.status(500).json({ ok: false, message: 'Internal server error' })
  }
})

module.exports = router
