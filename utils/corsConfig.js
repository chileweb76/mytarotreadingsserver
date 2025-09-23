// Centralized CORS configuration helper
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

// Build allowed origins from multiple env vars: ALLOWED_ORIGINS (comma-separated),
// CLIENT_URL and SERVER_URL. We deduplicate and normalize them.
const candidates = []
if (process.env.ALLOWED_ORIGINS) candidates.push(process.env.ALLOWED_ORIGINS)
if (process.env.CLIENT_URL) candidates.push(process.env.CLIENT_URL)
if (process.env.SERVER_URL) candidates.push(process.env.SERVER_URL)
// When running on Vercel, runtime exposes VERCEL_URL (e.g. myproj.vercel.app).
// Include it as an allowed origin so same-origin browser requests from the
// deployed domain are accepted even if SERVER_URL/CLIENT_URL are not set.
if (process.env.VERCEL_URL) candidates.push(`https://${process.env.VERCEL_URL}`)
if (candidates.length === 0) candidates.push('http://localhost:3000')

const joined = candidates.join(',')
const normalized = normalizeOrigin(joined)
const allowedOrigins = Array.isArray(normalized) ? normalized : (normalized ? [normalized] : [])
const allowedHostnames = allowedOrigins.map(hostnameOf).filter(Boolean)

module.exports = { normalizeOrigin, hostnameOf, allowedOrigins, allowedHostnames }
