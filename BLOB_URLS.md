Vercel Blob URLs — server usage

This file explains how the backend (`mytarotreadingsserver`) uploads images to Vercel Blob storage and returns blob URLs to the frontend.

Quick summary

- The server uses `@vercel/blob` `put()` to upload images to your Vercel Blob storage and stores the returned `url` on models (decks, cards, spreads, user profile pictures).
- The server provides helper scripts to seed or migrate images to blob and test uploads.

Important environment variables

- BLOB_READ_WRITE_TOKEN — required for scripts and server-side helpers that call `put()`.
  Add to your server `.env` or Vercel project environment variables:

  BLOB_READ_WRITE_TOKEN=vercel_blob_rw_xxxxx

Where the logic lives

- Upload / seed / migration scripts:
  - `scripts/migrateImages.js` (utility migration)
  - `scripts/seedRiderWaiteBlob.js` (deck seeding)
  - `scripts/seedSpreadsBlob.js` (spreads seeding)
  - `scripts/testBlobUpload.js` (quick upload test)

- Runtime helpers:
  - `utils/blobStorage.js` or similar (used by routes like `routes/auth.js`) — performs `put()` and `delete()` operations and returns blob URLs.

- Routes that expose image URLs:
  - `routes/images.js` — redirects legacy static requests to blob URLs if present.
  - `routes/auth.js` — handles profile picture upload and updates user records with blob URLs.
  - `routes/readings.js` and `api/*` — set `Access-Control-Allow-Headers` to include `x-vercel-blob-store` so frontend may send/read that header when needed.

How the frontend and server should interact

- Server returns model objects (deck, card, spread, reading) with `image` fields containing full HTTPS blob URLs when images have been migrated.
- Frontend should use these blob URLs directly. If the frontend still references static paths, run the migration script to create mappings or update records in the database to point to blob URLs.

Migration & testing

- Run a quick test upload (checks `BLOB_READ_WRITE_TOKEN`):

```bash
# from server project root
node scripts/testBlobUpload.js
```

- Migrate existing images:

```bash
node scripts/migrateImages.js
# or the higher-level helpers
npm run migrate:images
```

Notes on CORS & headers

- API endpoints add `Access-Control-Allow-Headers` including `x-vercel-blob-store` to allow clients and proxies to include that header if used. Most public blob URLs should be fetchable directly from the browser.
- If you proxy blob requests through your server (redirecting or streaming), make sure to forward or set the appropriate CORS headers.

Sample server response

- Deck/card data returned to the frontend should include `image`:

```json
{
  "_id": "...",
  "title": "Celtic Cross",
  "image": "https://<project>.public.blob.vercel-storage.com/spreads/celtic-cross-abc123.png"
}
```

Troubleshooting

- If migration scripts fail with a missing token, add `BLOB_READ_WRITE_TOKEN` to `.env` or set it in the shell before running.
- If uploads succeed but frontend can't load images, verify that the blob URL returned is fully qualified and publicly accessible in the Vercel dashboard.

Next steps I can take

- Add a simple debug endpoint that returns the current blob mapping for verification (so frontend can fetch `/api/blob-mapping`), or
 - Add a simple debug endpoint that returns the current blob mapping for verification (so frontend can fetch `/api/blob-mapping`). Note: by default this endpoint will require an admin token in production.

Security: admin token

- `BLOB_MAPPING_ADMIN_TOKEN` — set this env var on the server to require a token in order to access `/api/blob-mapping`. This prevents public exposure of internal mapping JSON. The endpoint supports the token via:
  - `x-admin-token` request header
  - `Authorization: Bearer <token>` header
  - `?token=` query parameter

Example (curl):

```bash
# using Authorization header
curl -H "Authorization: Bearer $BLOB_MAPPING_ADMIN_TOKEN" https://your-server.example.com/api/blob-mapping

# using custom header
curl -H "x-admin-token: $BLOB_MAPPING_ADMIN_TOKEN" https://your-server.example.com/api/blob-mapping
```
- Add a small admin UI for listing blob URLs.
