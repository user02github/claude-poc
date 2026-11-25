# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Minimal Express.js (v4, CommonJS) proof-of-concept running on an Ubuntu VM. The entire app lives in `index.js`. It builds the app via the factory `createApp({ rateLimit: { windowMs, limit } })` and exports the default instance as `module.exports` (plus `createApp` and `validateEchoBody` as named properties); `listen` is only called when run directly (`require.main === module`). Middleware order matters: `/api` rate limiter → `express.json({ limit: '10kb' })` → routes → JSON error handler (turns body-parser errors into 400/413 JSON instead of HTML). There is no build step and no linter configured. Tests use the built-in Node test runner (no Jest/Supertest).

## Commands

- `npm install` — install dependencies
- `npm start` — run the server (`node index.js`), default port 3000
- `PORT=3001 npm start` — run on a different port (port is read from `PORT`, fallback 3000)
- `npm test` — run all tests (`node --test`, picks up `test/*.test.js`)
- `node --test --test-name-pattern="GET /info"` — run a single test/suite by name

Tests in `test/*.test.js` start the app on port 0 (random free port) and hit it with the global `fetch`, so they don't clash with a server running on 3000. Error paths are tested by stubbing `os` methods with `t.mock.method`. Tests hitting `/api/*` must use `createApp({ rateLimit: { limit: ... } })` rather than the shared default instance, so each gets its own limiter counter and doesn't trip the default limit of 10.

## Routes

- `GET /` — plain text `Hello from Claude Code in Ubuntu!`
- `GET /info` — JSON with runtime info: `nodeVersion` (`process.version`), `platform`, `os`, `release`, `arch` (from Node's `os` module)
- `GET /health` — JSON `{ status: 'ok', uptime, timestamp }` (`uptime` = `process.uptime()` in Sekunden, `timestamp` = aktuelle Serverzeit als ISO-8601 in UTC)
- `GET /time` — JSON `{ time, unixMs, timeZone }` (`time` = aktuelle Serverzeit als ISO-8601 in UTC, `unixMs` = dieselbe Zeit in Millisekunden seit 1970, `timeZone` = Zeitzone des Servers, z. B. `Europe/Berlin`)
- `POST /api/echo` — body must be `application/json` (else 415) with exactly one field `message` (string, 1–1000 chars after trim; else 400 with `details`). Returns `{ echo: { message }, receivedAt }`.

All `/api/*` routes are rate-limited per IP via `express-rate-limit` (default 10 requests / 60 s, configurable with `RATE_LIMIT_MAX` and `RATE_LIMIT_WINDOW_MS`); exceeding it returns 429 with `Retry-After`. `/`, `/info`, `/health` and `/time` are not limited.

## Rules

- Every new API route must wrap its handler logic in `try/catch` and set HTTP status codes explicitly: `res.status(200)` (or `201` etc.) on success, an appropriate `4xx` for client errors, and `500` with a JSON error body in the `catch` block.

## Notes

- The user often keeps a server running on port 3000 via `npm start`. It does not hot-reload, so code changes require a restart. When verifying changes, start a separate instance on another port (e.g. `PORT=3001`) instead of killing the user's process.
- Console output and user-facing communication are in German.
