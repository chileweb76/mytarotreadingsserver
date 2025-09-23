// Small serverless endpoint to inspect non-sensitive env vars from the deployed function
// This helps verify what the server actually sees for CLIENT_URL/Server URL and normalized origins.

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

module.exports = (req, res) => {
  const rawClient = process.env.CLIENT_URL || process.env.SERVER_URL || null
  const normalized = normalizeOrigin(rawClient)
  const allowedOrigins = Array.isArray(normalized) ? normalized : (normalized ? [normalized] : [])
  const allowedHostnames = allowedOrigins.map(hostnameOf).filter(Boolean)

  // CORS preflight handling
  const origin = req.headers.origin
  if (req.method === 'OPTIONS') {
    if (!origin) return res.status(204).end()
    let allowOrigin = '*'
    if (allowedOrigins.indexOf(origin) !== -1) allowOrigin = origin
    else {
      try {
        const incomingHost = new URL(origin).hostname.replace(/^www\./i, '').toLowerCase()
        if (allowedHostnames.indexOf(incomingHost) !== -1 || incomingHost.endsWith('.vercel.app')) allowOrigin = origin
      } catch (e) {}
    }
    res.setHeader('Access-Control-Allow-Origin', allowOrigin)
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', req.headers['access-control-request-headers'] || 'Content-Type')
    res.setHeader('Access-Control-Allow-Credentials', 'true')
    try { res.setHeader('Vary', 'Origin') } catch (e) {}
    return res.status(204).end()
  }

  res.setHeader('Content-Type', 'application/json')
  res.status(200).json({ ok: true, rawClient, allowedOrigins, allowedHostnames })
}
