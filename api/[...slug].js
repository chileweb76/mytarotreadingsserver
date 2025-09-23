// Vercel serverless catch-all that mounts the Express app exported by root `index.js`.
// Vercel often strips the `/api` prefix when invoking the function. Because this
// project registers routes with an `/api/...` prefix in `index.js`, we rewrite
// `req.url` to re-add `/api` so the Express router matches the expected paths.

const app = require('../index')

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

const { allowedOrigins, allowedHostnames } = require('../utils/corsConfig')

module.exports = (req, res) => {
	// Handle CORS preflight at the edge for any route forwarded by this catch-all.
	if (req.method === 'OPTIONS') {
		const origin = req.headers.origin
		if (!origin) {
			res.statusCode = 204
			res.end()
			return
		}

		// exact origin match
		if (allowedOrigins.indexOf(origin) !== -1) {
			res.setHeader('Access-Control-Allow-Origin', origin)
		} else {
			// try hostname match
			let incomingHost
			try {
				incomingHost = new URL(origin).hostname.replace(/^www\./i, '').toLowerCase()
			} catch (e) {
				res.statusCode = 403
				res.end('Forbidden')
				return
			}
			if (allowedHostnames.indexOf(incomingHost) !== -1) {
				res.setHeader('Access-Control-Allow-Origin', origin)
			} else {
				res.statusCode = 403
				res.end('Forbidden')
				return
			}
		}

		res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS')
		res.setHeader('Access-Control-Allow-Headers', req.headers['access-control-request-headers'] || 'Content-Type, Authorization, X-Requested-With, Accept, Origin')
		res.setHeader('Access-Control-Allow-Credentials', 'true')
		res.setHeader('Access-Control-Max-Age', '3600')
		res.statusCode = 204
		res.end()
		return
	}

	try {
		// If the incoming URL already starts with /api, leave it; otherwise
		// prefix it so routes declared as `/api/...` match correctly.
		if (!req.url.startsWith('/api')) {
			req.url = `/api${req.url}`
		}
	} catch (e) {
		// ignore and proceed
	}

	return app(req, res)
}
