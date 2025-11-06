# Admin Metrics Data Source

## Overview

The admin dashboard aggregates overview, performance, and engagement metrics from a GitHub data repository. The server attempts GitHub reads first and falls back to local filesystem data on failure.

## Default Repository

- Default: `SemperAdmin/Fitness-Report-Evaluator-Data`
- Public repos: read-only metrics work without a token (subject to rate limits)
- Private repos: set a server-side token for authenticated reads

## Environment Variables

- `DATA_REPO`: Override data repo (`owner/repo`). Default: `SemperAdmin/Fitness-Report-Evaluator-Data`.
- `FITREP_DATA`: GitHub Personal Access Token (PAT) used server-side for authenticated reads and writes.
- `ALLOW_DEV_TOKEN`: If `true`, exposes a dev-only token endpoint (`/api/github-token`). Never enable in production.
- `CORS_ORIGINS`: Comma-separated list of allowed origins for admin APIs.
- `PORT`, `NODE_ENV`: Standard server configuration.

## Quickstart

1. Copy `.env.example` to `.env` and adjust values as needed.
2. For private repos, create a PAT with `repo` scope and set `FITREP_DATA`.
3. Start the server: `PORT=5181 node server/server.js` (Windows PowerShell: `$env:PORT=5181; node server\\server.js`).
4. Open `http://localhost:5181/admin.html` to view GitHub-backed metrics.

## Local Filesystem Fallback

If GitHub fetch fails or rate limits are exceeded, the server uses `server/local-data/` to compute metrics so the admin UI remains functional during outages.

