// Dedicated serverless entry for /api/auth/login to ensure preflight OPTIONS are handled
// and to forward non-OPTIONS requests to the Express app mounted in ../index.js

const app = require('../../index')
const { allowedOrigins, allowedHostnames } = require('../../utils/corsConfig')

function isAllowedOrigin(origin) {
  if (!origin) return false
  if (allowedOrigins.indexOf(origin) !== -1) return true
  try {
    const incomingHost = new URL(origin).hostname.replace(/^www\./i, '').toLowerCase()
    if (allowedHostnames.indexOf(incomingHost) !== -1) return true
    if (incomingHost && incomingHost.endsWith('.vercel.app')) return true
  } catch (e) {}
  return false
}

function setCorsForOrigin(res, origin) {
  try { res.setHeader('Vary', 'Origin') } catch (e) {}
  res.setHeader('Access-Control-Allow-Origin', origin)
  res.setHeader('Access-Control-Allow-Credentials', 'true')
}

module.exports = (req, res) => {
  const origin = req.headers.origin

  // preflight: respond with CORS headers directly
  if (req.method === 'OPTIONS') {
    if (!origin) {
      res.status(204).end()
      return
    }

    if (!isAllowedOrigin(origin)) {
      res.status(403).end('Forbidden')
      return
    }

    setCorsForOrigin(res, origin)
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', req.headers['access-control-request-headers'] || 'Content-Type, Authorization, X-Requested-With, Accept, Origin')
    res.setHeader('Access-Control-Max-Age', '3600')
    res.status(204).end()
    return
  }

  // For non-OPTIONS, forward to Express app. Ensure req.url is what Express expects.
  try {
    if (!req.url.startsWith('/api')) {
      req.url = `/api${req.url}`
    }
  } catch (e) {}

  // For POST requests, echo CORS headers so browsers see them on the actual response
  if (req.method === 'POST' && origin && isAllowedOrigin(origin)) {
    setCorsForOrigin(res, origin)
  }

  return app(req, res)
}
