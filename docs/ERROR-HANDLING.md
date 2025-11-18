Error Handling System

Overview
- Provides a centralized mechanism to capture, classify, and persist errors.
- Standardizes try-catch usage and error reporting across modules.
- Integrates optional remote reporting for monitoring and alerts.

Severity Levels
- `info`: Non-error diagnostics; not used for exceptions.
- `warn`: Recoverable issues; degraded features, retries, fallbacks active.
- `error`: Significant failures; user-visible impact; continue when safe.
- `critical`: Uncaught exceptions or system-level failures; show banner and record for triage.

Logging Requirements
- Use `ErrorLogger.logError(error, context, severity)` in catch blocks.
- Include meaningful `message` and `stack` (from `Error` objects).
- Provide `context` with at least: `module`, `action` and optional `stage`, `id`, `args`.
- All logs include timestamp, type/name, severity, and context.
- Local persistence: `localStorage['fitrep_error_logs']` capped by `maxStored`.
- Optional remote: POST to `config.remoteUrl` when `remoteEnabled`.

Try-Catch Guidelines
- Catch closest to likely failure points; keep scopes tight.
- Log once per failure path with appropriate severity.
- Prefer recoveries (fallback data, retries, user notices) where safe.
- Re-throw when the error indicates corrupted state, security, or data integrity risk.
- Do not swallow exceptions silently; always log.

Centralized Logger
- Module: `js/errorLogger.js`. Initializes early in `index.html`.
- Global handlers: `window.onerror`, `unhandledrejection` to capture uncaught errors as `critical`.
- Sinks: Console, `localStorage`, optional remote endpoint.
- Utilities: `wrap(fn, context)` to auto-log and rethrow, `addBreadcrumb(crumb)`, `setUser(user)`, `setConfig(cfg)`, `getLogs()`.

Monitoring/Alerting
- Enable remote reporting via `ErrorLogger.setConfig({ remoteEnabled: true, remoteUrl })`.
- Back-end can route payloads to monitoring tools (e.g., Sentry proxy, logs collector).

Error Boundaries
- This project uses vanilla JS; React boundaries are not applicable.
- If React components are introduced, add `<ErrorBoundary>` around root and critical subtrees to catch render errors and display user-friendly messages.

Testing
- Unit tests in `tests/errorLogger.test.js` verify:
  - Log capture with severity and stack.
  - Storage sink persistence.
  - `wrap` rethrows while logging.
- Extend tests to simulate quota errors and import failures where feasible.

Adoption Plan
- Load `errorLogger.js` before other scripts.
- Incrementally revise try-catch blocks to call `ErrorLogger.logError(...)`.
- Add remote reporting in staging/production environments.

