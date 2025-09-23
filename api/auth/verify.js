// Serverless entry for /api/auth/verify to ensure OPTIONS preflight and
// proper CORS headers are present for browser flows. For direct clicks
// (no Origin header) this forwards the GET to the Express app unchanged.

const app = require('../../index')

const { allowedOrigins, allowedHostnames } = require('../../utils/corsConfig')

function hostnameOf(urlOrHost) {
  if (!urlOrHost) return null
  try {
    const u = new URL(urlOrHost)
    return (u.hostname || '').replace(/^www\./i, '').toLowerCase()
  } catch (e) {
    return String(urlOrHost).replace(/^www\./i, '').toLowerCase()
  }
}

module.exports = (req, res) => {
  const origin = req.headers.origin

  // Handle preflight OPTIONS
  if (req.method === 'OPTIONS') {
    if (!origin) {
      res.status(204).end()
      return
    }

    if (allowedOrigins.indexOf(origin) !== -1) {
      res.setHeader('Access-Control-Allow-Origin', origin)
    } else {
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
        res.status(403).end('Forbidden')
        return
      }
    }

    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', req.headers['access-control-request-headers'] || 'Content-Type, Authorization, X-Requested-With, Accept, Origin')
    res.setHeader('Access-Control-Allow-Credentials', 'true')
    res.setHeader('Access-Control-Max-Age', '3600')
    res.status(204).end()
    return
  }

  // For GET requests coming from a browser with an Origin header,
  // set the Access-Control-Allow-Origin header on the actual response
  // so client-side code can observe cookies/redirects when needed.
  if (req.method === 'GET') {
    if (origin) {
      if (allowedOrigins.indexOf(origin) !== -1) {
        res.setHeader('Access-Control-Allow-Origin', origin)
      } else {
        let incomingHost
        try {
          incomingHost = new URL(origin).hostname.replace(/^www\./i, '').toLowerCase()
        } catch (e) {
          // If origin is malformed, deny
          res.status(403).end('Forbidden')
          return
        }
        if (allowedHostnames.indexOf(incomingHost) !== -1) {
          res.setHeader('Access-Control-Allow-Origin', origin)
        } else {
          res.status(403).end('Forbidden')
          return
        }
      }
      res.setHeader('Access-Control-Allow-Credentials', 'true')
    }
  }

  // Ensure the forwarded URL begins with /api for Express
  try {
    if (!req.url.startsWith('/api')) {
      req.url = `/api${req.url}`
    }
  } catch (e) {}

  return app(req, res)
}
