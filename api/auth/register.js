// Dedicated serverless entry for /api/auth/register to ensure preflight OPTIONS are handled
// and to forward non-OPTIONS requests to the Express app mounted in ../index.js

const app = require('../../index')

function normalizeOrigin(raw) {
  if (!raw) return null
  const trimmed = ('' + raw).trim()
  if (!trimmed) return null
  if (trimmed.includes(',')) return trimmed.split(',').map(s => normalizeOrigin(s)).filter(Boolean)
  if (/^https?:\/\//i.test(trimmed)) return trimmed.replace(/\/$/, '')
  return `https://${trimmed.replace(/\/$/, '')}`
}

function hostnameOf(urlOrHost) {
  if (!urlOrHost) return null
  try {
    const u = new URL(urlOrHost)
    return (u.hostname || '').replace(/^www\./i, '').toLowerCase()
  } catch (e) {
    return String(urlOrHost).replace(/^www\./i, '').toLowerCase()
  }
}

const rawClient = process.env.CLIENT_URL || process.env.SERVER_URL || null
const normalized = normalizeOrigin(rawClient)
const allowedOrigins = Array.isArray(normalized) ? normalized : (normalized ? [normalized] : [])
const allowedHostnames = allowedOrigins.map(hostnameOf).filter(Boolean)

module.exports = (req, res) => {
  const origin = req.headers.origin

  // preflight: respond with CORS headers directly
  if (req.method === 'OPTIONS') {
    if (!origin) {
      res.status(204).end()
      return
    }

    // exact match
    if (allowedOrigins.indexOf(origin) !== -1) {
      res.setHeader('Access-Control-Allow-Origin', origin)
    } else {
      // try hostname match
      let incomingHost
      try {
        incomingHost = new URL(origin).hostname.replace(/^www\./i, '').toLowerCase()
      } catch (e) {
        res.status(403).end('Forbidden')
        return
      }
      if (allowedHostnames.indexOf(incomingHost) !== -1) {
        res.setHeader('Access-Control-Allow-Origin', origin)
      } else {
        // Not allowed
        res.status(403).end('Forbidden')
        return
      }
    }

    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', req.headers['access-control-request-headers'] || 'Content-Type, Authorization, X-Requested-With, Accept, Origin')
    res.setHeader('Access-Control-Allow-Credentials', 'true')
    // Cache preflight for 1 hour where appropriate
    res.setHeader('Access-Control-Max-Age', '3600')
    // short-circuit preflight with no body
    res.status(204).end()
    return
  }

  // For non-OPTIONS, forward to Express app. Ensure req.url is what Express expects.
  try {
    if (!req.url.startsWith('/api')) {
      req.url = `/api${req.url}`
    }
  } catch (e) {}

  return app(req, res)
}
