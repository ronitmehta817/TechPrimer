# TechPrimer

A Cloudflare Workers personal site project.

## Overview

This project serves as a personal website / tech primer built with Cloudflare Workers. It features:

- Auth flow (login, callback, logout) with rate limiting
- API endpoints for storing/retrieving user data via KV
- Static asset serving for the front-end
- KV namespace for persistent storage

## Prerequisites

Before first deployment:

1. Run `npm run kv:create` and paste the returned `id` into `wrangler.toml` as `id`
2. Run `npm run kv:create:preview` and paste the returned `id` into `preview_id`
3. Set secrets via `npx wrangler secret put`:
   - `GOOGLE_CLIENT_SECRET`
   - `SESSION_SECRET` (use `openssl rand -hex 32`)
4. Optionally set `GOOGLE_CLIENT_ID` in the `[vars]` block or via the Cloudflare dashboard

## Development

| Script | Description |
|---|---|
| `npm run dev` | Start local development server via `wrangler dev` |
| `npm run deploy` | Deploy to Cloudflare |
| `npm run kv:create` | Create a new KV namespace |
| `npm run test` | Run validation checks |

## Local Testing

The app runs locally at `http://127.0.0.1:8787`. All routes and static assets are served from this endpoint.

## Routes

- `GET /auth/login` - Login page
- `GET /auth/callback` - OAuth callback
- `GET /auth/logout` - Logout
- `GET /api/me` - Get current user session
- `GET/PUT /api/store` - Store/retrieve user data (auth required)

## KV Namespace

- `USER_STORE` - Binds to the configured KV namespace ID
