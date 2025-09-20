// Vercel serverless catch-all that mounts the Express app exported by root `index.js`.
// Vercel often strips the `/api` prefix when invoking the function. Because this
// project registers routes with an `/api/...` prefix in `index.js`, we rewrite
// `req.url` to re-add `/api` so the Express router matches the expected paths.

const app = require('../index')

module.exports = (req, res) => {
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
