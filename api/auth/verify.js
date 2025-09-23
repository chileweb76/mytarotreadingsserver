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
  module.exports = async (req, res) => {
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

    // For GET requests invoked from email links, forward to the Express app
    // so the API's verification logic runs server-side and can return the
    // appropriate redirect or JSON response. This avoids sending users to a
    // client page that may not exist and makes email clicks verify directly.
    if (req.method === 'GET') {
      // Serve a small HTML page that will POST the token to the API's POST
      // /api/auth/verify endpoint from the browser. This avoids redirecting
      // users to a client route that may not exist and gives immediate
      // feedback while the serverless function does the DB work.
      const token = (req.query && req.query.token) || ''
      const clientBase = (process.env.CLIENT_URL || '').replace(/\/$/, '')
      const tokenJson = JSON.stringify(token)
      const clientBaseJson = JSON.stringify(clientBase)
      const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Verifying…</title>
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <style>body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial;margin:2rem}</style>
  </head>
  <body>
    <h1>Verifying your email…</h1>
    <div id="status">Please wait — this may take a few seconds.</div>
    <script>
      (async function(){
        const token = JSON.parse(${tokenJson});
        const clientBase = JSON.parse(${clientBaseJson});
        try {
          const resp = await fetch('/api/auth/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token })
          });
          const body = await resp.json().catch(() => ({}));
          if (resp.ok) {
            if (clientBase) {
              window.location = clientBase + '/auth/success?verified=true'
            } else {
              document.getElementById('status').innerText = 'Email verified successfully.'
              const pre = document.createElement('pre')
              pre.textContent = JSON.stringify(body, null, 2)
              document.body.appendChild(pre)
            }
          } else {
            document.getElementById('status').innerText = 'Verification failed.'
            const pre = document.createElement('pre')
            pre.textContent = JSON.stringify(body, null, 2)
            document.body.appendChild(pre)
          }
        } catch (e) {
          document.getElementById('status').innerText = 'Verification error: ' + (e && e.message ? e.message : String(e))
        }
      })()
    </script>
  </body>
</html>`

      res.setHeader('Content-Type', 'text/html; charset=utf-8')
      res.statusCode = 200
      res.end(html)
      return
    }

    // Fallback: forward to Express app for anything else (including POST)
    try {
      if (!req.url.startsWith('/api')) req.url = `/api${req.url}`
    } catch (e) {}
    return app(req, res)
  }
}
