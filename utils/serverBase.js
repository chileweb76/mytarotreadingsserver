// Helper to build a canonical server base URL for use in emails and absolute URLs.
// Prefers `process.env.SERVER_URL` when set. Otherwise infers from the request
// and respects common forwarded headers used by proxies (e.g., Vercel).
function buildServerBase(req) {
  if (process.env.SERVER_URL && process.env.SERVER_URL.trim()) {
    return process.env.SERVER_URL.trim().replace(/\/$/, '')
  }
  const proto = (req && req.headers && (req.headers['x-forwarded-proto'] || req.headers['x-forwarded-protocol'])) || (req && req.protocol) || 'https'
  const host = (req && req.get && req.get('host')) || ''
  return `${proto}://${host}`.replace(/\/$/, '')
}

module.exports = { buildServerBase }
