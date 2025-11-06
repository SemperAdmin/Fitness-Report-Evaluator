# Feedback System Setup

This guide explains how to enable and test the in-app feedback widget, which securely submits feedback to GitHub issues or stores locally during development.

## Overview

- Frontend adds a floating "Feedback" button on `index.html` and `admin.html` that opens an accessible modal.
- Submissions POST to `POST /api/feedback` with sanitized fields.
- Server creates a GitHub issue in `GITHUB_REPO` using `GITHUB_TOKEN`. If no token is set, feedback is saved locally under `server/local-data/feedback` (or OS temp dir via `LOCAL_DATA_DIR`).
- A debug route `GET /api/debug/github` exposes minimal configuration for troubleshooting.

## Prerequisites

- Node.js 18+
- A GitHub Personal Access Token with `repo:issues` scope (fine-grained or classic), recommended fine-grained restricted to the repository where issues will be created.

## Configure Environment

1. Copy `.env.example` to `.env` and set:
   - `GITHUB_TOKEN=ghp_...` (token used for issue creation)
   - `GITHUB_REPO=owner/repo` (repository to receive feedback issues)
   - Optional: `CORS_ORIGINS` if serving the frontend from a different origin
   - Optional: `ALLOW_DEV_TOKEN=false` (keep false in production; controls a dev-only token endpoint unrelated to feedback)

2. If you prefer local storage only (no GitHub), leave `GITHUB_TOKEN` unset. The server will store submissions under a local folder for triage.

## Run Locally

```sh
node server/server.js
```

The server serves static files and APIs at `http://localhost:5173/`.

## Test the Feedback Flow

1. Open `http://localhost:5173/` and click the "Feedback" button.
2. Choose a type, enter a short title, and describe your feedback.
3. Optionally add your email (will be public in the GitHub issue).
4. Submit.

Expected results:
- With `GITHUB_TOKEN` set: You receive a success message with a link to the created GitHub issue.
- Without `GITHUB_TOKEN`: You receive a success message indicating local storage. Files are written to `LOCAL_DATA_DIR/feedback` (defaults to OS temp dir under `fitrep-local/feedback`).

## Server Endpoints

- `POST /api/feedback`
  - Request JSON fields: `type`, `title`, `description`, optional `email`, optional `context` (automatically captured by the widget).
  - Returns `{ ok: true, issueUrl, issueNumber }` on success to GitHub, or `{ ok: true, stored: 'local', file }` when stored locally.

- `GET /api/debug/github`
  - Returns a minimal configuration snapshot: repos, whether tokens are present, and dev exposure status.

## Security Notes

- Inputs are sanitized server-side to remove control characters.
- Do not enable `ALLOW_DEV_TOKEN` in production.
- Use fine-grained PAT limited to `GITHUB_REPO` for issue creation when possible.

## Troubleshooting

- Issue creation fails with 401/403:
  - Verify `GITHUB_TOKEN` is set and has `repo:issues` access to `GITHUB_REPO`.
  - Check `GITHUB_REPO` formatting (`owner/repo`).

- CORS errors:
  - Set `CORS_ORIGINS` to include the frontend origin, e.g. `http://localhost:5173` or your GitHub Pages domain.

- No token configured:
  - Submissions are stored locally. Inspect `fitrep-local/feedback` in your OS temp directory or set `LOCAL_DATA_DIR` to override.

