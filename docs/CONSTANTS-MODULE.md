# Constants Module Architecture

Purpose
- Centralize configuration values, UI strings, numeric settings, and route paths.
- Eliminate magic numbers and hardcoded strings across the codebase.
- Provide isomorphic exports for both browser (`window.CONSTANTS`) and Node (`module.exports`).

File
- `js/constants.js`

Categories
- `API_CONFIG`: Environment URLs and defaults (e.g., `RENDER_URL`, `DEFAULT_LOCAL_PORT`).
- `ROUTES.API`: Canonical backend endpoints (e.g., `ACCOUNT_LOGIN`).
- `UI_SETTINGS.DISPLAY`: Standard display values (e.g., `BLOCK`, `NONE`).
- `UI_SETTINGS.CSS`: Shared class names (e.g., `ACTIVE`, `ONLINE`, `OFFLINE`).

Local development CORS notes:
- When serving the frontend from `http://127.0.0.1:5500` and backend from `http://localhost:5173`, browsers treat this as cross-origin.
- Cookies used for authentication will not be sent on HTTP cross-origin requests due to SameSite restrictions.
- To enable authenticated API calls locally, either run both frontend and backend on the same origin, or serve via HTTPS with proper CORS.
- Backend can explicitly allow origins by setting `CORS_ORIGINS` (comma-separated), e.g.: `CORS_ORIGINS="http://127.0.0.1:5500,http://localhost:5173"`.
- `STATUS_MESSAGES`: User-facing connectivity status messages.
- `MODAL_CONFIG`: Modal class name and z-index base.

Usage Patterns
- Browser: load `js/constants.js` early in `index.html`. Access as `window.CONSTANTS`.
- Node: `const CONSTANTS = require('../js/constants.js');`

Examples
```js
// UI helper
const { UI_SETTINGS } = window.CONSTANTS;
el.style.display = UI_SETTINGS.DISPLAY.BLOCK;
el.classList.add(UI_SETTINGS.CSS.ACTIVE);

// Server routes
const { ROUTES } = require('../js/constants.js');
app.post(ROUTES.API.ACCOUNT_LOGIN, handler);
```

Typing and Documentation
- JSDoc typedefs included for categories and primary shapes.
- Extend types when new constants are introduced; keep comments up to date.

Maintenance
- Add new constants to the appropriate category; avoid ad-hoc values.
- Prefer reusing existing constants over creating duplicates.
- If a constant becomes obsolete, follow deprecation procedures in contribution guide.
