// Vercel serverless catch-all that mounts the Express app exported by root `index.js`.
// This file ensures Vercel routes `/api/*` to the app when the project root contains an
// Express app exported as `module.exports = app` (see index.js).

const app = require('../index')

// Vercel will accept an Express app or a handler function. Export the app.
module.exports = app
