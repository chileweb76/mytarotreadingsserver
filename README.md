# MyTarotReadings Server

This repository contains the server for the MyTarotReadings application.

## Docs

- See `docs/verify-client.md` for recommended client-side verification flow in serverless deployments.

## Quick start

- See project `package.json` scripts for local dev and test commands.

## Session store (Upstash / Redis)

This server can optionally use a Redis-backed session store (recommended for
serverless deployments). To enable an Upstash or other Redis session store,
set one of the following environment variables in your deployment:

- `REDIS_URL` or `REDIS_TLS_URL` (Upstash TLS URL or redis:// / rediss:// URL)
- `USE_PERSISTENT_SESSIONS=true` to force persistent sessions in serverless

If `REDIS_URL` is provided the server will attempt to configure `connect-redis`
automatically. If Redis is not available, the server will fall back to
`connect-mongo` when `MONGODB_URI` is set.
