# MyTarotReadings Server

This repository contains the server for the MyTarotReadings application.

## Docs

- See `docs/verify-client.md` for recommended client-side verification flow in serverless deployments.

## Quick start

- See project `package.json` scripts for local dev and test commands.

## Session store (deprecated)

This project previously supported server-side sessions (Redis / Upstash / Mongo)
for serverless deployments. The codebase has since moved to a stateless JWT-based
authentication model which is more reliable for serverless platforms. Server-side
session support has been removed. If you need server-side sessions in the future
please open an issue or a PR to reintroduce a well-scoped session-store helper.
- `USE_PERSISTENT_SESSIONS=true` to force persistent sessions in serverless
