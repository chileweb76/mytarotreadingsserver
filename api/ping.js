const { allowedOrigins, allowedHostnames } = require('../utils/corsConfig')

function allowOriginFor(req, res) {
  const origin = req.headers.origin
  if (!origin) return '*'
  if (allowedOrigins.indexOf(origin) !== -1) return origin
  try {
    const incomingHost = new URL(origin).hostname.replace(/^www\./i, '').toLowerCase()
    if (allowedHostnames.indexOf(incomingHost) !== -1) return origin
    if (incomingHost && incomingHost.endsWith('.vercel.app')) return origin
  } catch (e) {}
  return null
}

module.exports = (req, res) => {
  // handle simple preflight
  if (req.method === 'OPTIONS') {
    const origin = allowOriginFor(req, res)
    if (!origin) return res.status(403).end('Forbidden')
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', req.headers['access-control-request-headers'] || 'Content-Type')
    res.setHeader('Access-Control-Allow-Credentials', 'true')
    try { res.setHeader('Vary', 'Origin') } catch (e) {}
    return res.status(204).end()
  }

  const origin = allowOriginFor(req, res)
  if (origin) res.setHeader('Access-Control-Allow-Origin', origin)
  res.status(200).json({ ok: true, message: 'pong', timestamp: new Date().toISOString() })
}
