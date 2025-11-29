# Configuration Profiles

This project supports multiple deployment profiles. Configure via environment variables.

## Development
- `NODE_ENV=development`
- `SESSION_SECRET`: optional (development only)
- `CORS_ORIGINS`: comma-separated origins; defaults allow localhost and GitHub Pages
- `ALLOW_DEV_TOKEN=false`
- `FITREP_DATA`: optional for GitHub data reads/writes
- `DISPATCH_TOKEN`: optional for repository_dispatch
- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`: optional; when set, storage mode switches to `supabase`
- `REDIS_URL`: optional; enables distributed rate limiting and validation cache
- `USE_CUSTOM_CORS=true`: fallback to custom CORS if external libs unavailable

## Staging
- `NODE_ENV=production`
- `SESSION_SECRET`: required, strong random value
- `CORS_ORIGINS`: strict list of staging origins
- `ALLOW_DEV_TOKEN=false`
- `FITREP_DATA` and `DISPATCH_TOKEN`: set to scoped tokens with least privilege
- `REDIS_URL`: set to staging Redis instance
- `LOG_LEVEL=info`

## Production
- `NODE_ENV=production`
- `SESSION_SECRET`: required, strong random value (startup fails if weak/missing)
- `CORS_ORIGINS`: strict production origins
- `ALLOW_DEV_TOKEN=false`
- `FITREP_DATA` and `DISPATCH_TOKEN`: scoped PATs; rotate regularly
- `SUPABASE_*`: configured for primary storage when used
- `REDIS_URL`: production Redis for rate limiting/cache
- `LOG_LEVEL=warn`

## Notes
- CSRF: Double-submit cookie with header is enforced by server. The CSRF token is issued during login and returned in the response body for cross-origin usage.
- Admin Router: Mounted at `/api/admin` and guarded via local/admin hints. For production, integrate a proper admin authentication flow.
- Static Files: In local runs, Express serves static assets after all API routes for convenience.
