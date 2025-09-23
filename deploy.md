# Deploy notes (Vercel)

Quick reference for environment variables and tips to deploy the server on Vercel.

1) Add environment variables in the Vercel Project Settings -> Environment Variables.
   - Make sure to add them for the correct environment (Production, Preview, Development) and mark secrets as such.

Essential variables
  - `MONGODB_URI` — your MongoDB connection string (use Atlas SRV or standard URL). Example: `mongodb+srv://user:pass@cluster0.mongodb.net/mydb?retryWrites=true&w=majority`
  - `MONGODB_DB_NAME` — optional but recommended: the name of the DB to avoid defaulting to `test`.
  - `JWT_SECRET` — required for signing JWTs (strong random string).
  - `SESSION_SECRET` — required if using `express-session` (strong random string).
  - `CLIENT_URL` — front-end URL used for redirects (e.g., `https://app.example.com`).
  - `SERVER_URL` — optional; used to build absolute links in emails if set.
  - `NODE_ENV` — `production` for production deployments (Vercel sets this automatically).

Optional / features
  - `REDIS_URL` or `REDIS_TLS_URL` — Upstash or other Redis provider URL. When present, the server will attempt to configure `connect-redis` automatically and enable persistent sessions in non-serverless mode.
    - Upstash TLS example: `rediss://:<token>@eu1-upstash.redis.upstash.io:6379`
  - `USE_PERSISTENT_SESSIONS=true` — if set in a serverless deployment, the app will mount sessions when a persistent store is configured.
  - `ENABLE_VERBOSE_ERRORS=true` — useful temporarily to surface richer errors in production for debugging; remove or set to `false` after triage.

Email / Courier (optional)
  - `COURIER_AUTH_TOKEN` — API token if using Courier to send verification/reset emails.
  - `COURIER_TEMPLATE_ID`, `COURIER_VERIFY_TEMPLATE_ID`, `COURIER_RESET_TEMPLATE_ID` — template IDs for Courier messages.

Debugging and tips
  - If you see unexpected `500` responses on auth endpoints, enable `ENABLE_VERBOSE_ERRORS=true` (temporary) and check Vercel function logs for stack traces.
  - If Mongo connections appear to default to `test`, set `MONGODB_DB_NAME` to the correct database name or include it in the `MONGODB_URI` (e.g., `.../mytarotreadings?`).
  - For serverless deployments prefer stateless JWT authentication. Use `REDIS_URL` + `USE_PERSISTENT_SESSIONS=true` only if you need server-side sessions and are comfortable with Upstash or a managed Redis.

Deploy steps (quick)
  - Push your branch to GitHub and import the repo to Vercel (or connect via Vercel CLI).
  - In Vercel Project Settings, add the environment variables above.
  - Trigger a new deployment.

Extras
  - To seed the public JSON data locally or on a machine with access to your DB, run:

```bash
npm run seed:public
```

That will read the `seed/` and `templates/` JSON files and insert spreads/decks into the configured MongoDB.

Be cautious: do not commit secrets to source control — use Vercel's Environment Variables UI.
