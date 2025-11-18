## Overview
- Goal: audit functionality across frontend and backend, resolve runtime errors, ensure smooth evaluation flow, reliable persistence, and safe integrations.
- Scope: UI flow (setup → traits → directed comments → Section I → summary), global handler exposure, state and navigation, API base selection, authentication/CSRF, GitHub/local storage, CORS/CSP, error logging, and tests.

## Phase 1: Critical Runtime Stability
- Audit inline handlers in `index.html` and confirm global exposure for functions used (`handleGradeAction`, `startEvaluation`, `saveJustification`, `startReevaluation`, `generateSectionIComment`, `regenerateWithStyle`, `skipSectionI`, `finalizeSectionI`, `skipDirectedComments`, `finalizeDirectedComments`, `openHelpModal`, `closeHelpModal`, profile actions).
- Ensure all such functions are either declared in global scope or explicitly bound to `window` in their modules.
- Remove or rename duplicate global functions that shadow module-scoped ones (e.g., second `updateProgress` in `js/utils.js` referencing module-private variables). Keep one source of truth (`EvaluationAPI.updateProgress`) and adapt callers.
- Harden DOM access by null-checking `getElementById(...)` results before using `.style`/`.textContent` in all modules (already applied in evaluation start; extend to navigation, summary, modals).
- Confirm trait initialization: `firepData` structure exists and is loaded before evaluation (from `js/data.js`), and trait fields (`sectionKey`, `traitKey`, `gradeDescriptions`) are present. Add guards/fallbacks when missing.

## Phase 2: Navigation and State Consistency
- Unify step gating logic: use a single `isStepAccessible` that checks either `evaluationMeta` or required setup inputs (name, dates, rank, occasion, RS yes/no).
- Ensure `jumpToStep` honors gating and shows a clear toast explaining prerequisites when blocked.
- Validate that `startStandaloneMode`, `showRSLoginFirst`, and dashboard transitions consistently hide/show cards and header/warning elements without assuming their presence.

## Phase 3: Evaluation Flow UX
- Verify first trait rendering: grade buttons, description, and level progression (B→D→F→G) work; ensure `getGradeNumber` is available from `js/utils.js`.
- Ensure justification modal opens, seeds existing text on re-evaluation, and saves without errors.
- Validate review screen grouping and Edit/Re-evaluate buttons.
- Section I generation: provide default implementations for `generateSectionIComment`, `regenerateWithStyle`, and word count updates.
- Directed comments: confirm grid population, selection persistence, and finalize step.

## Phase 4: API Base Selection and CORS
- Fix default API base override for local dev: prefer same-origin when running on backend ports including `10000`. Add port `10000` to KNOWN_BACKEND_PORTS or explicitly detect server banner/route availability.
- Provide `?api=local` / `?api=render` override with clear UI hint and persist choice to `localStorage`.
- Review CSP `connect-src` to include same-origin and configured backend; keep `unsafe-inline` temporarily but plan a nonce-based migration.

## Phase 5: Authentication, Session, and CSRF
- Confirm login and create account flows send `X-CSRF-Token` when cookie is present; centralize in `postJson`/`postForm` helpers (already implemented, validate usage everywhere).
- Ensure backend cookies set `SameSite` and `Secure` appropriately; verify cross-origin behavior and UX messaging for HTTP local testing.
- Add graceful error messages for `401/403/429/5xx` and retry/backoff handling (present in helpers, extend to all API calls).

## Phase 6: Persistence and GitHub Integration
- Standardize saving evaluations: prefer server direct write with `FITREP_DATA` when available; otherwise fell back to local filesystem; GitHub token only in dev when explicitly enabled.
- Make RS profile updates propagate to evaluation files and aggregate user file, using `previousEmail` for password hash migration (already implemented, verify end-to-end).
- Synchronization UI: surface pending items, provide sync-all action with status feedback.

## Phase 7: Error Logging and Diagnostics
- Keep in-page error banner minimal and throttle duplicates; categorize `critical` vs `warning`.
- Store recent errors in localStorage for offline triage; add a small in-app “View Errors” panel for dev.
- Optional: wire Render CD issue creation toggles based on env vars to avoid noise in local/dev.

## Phase 8: Performance and Accessibility
- Defer heavy DOM updates with `requestAnimationFrame` where appropriate (tables, review list); reuse `RAFQueue`.
- Ensure modals are focus-trapped, ARIA attributes set; confirm keyboard navigation (`Escape`, `Ctrl+S`) works and doesn’t collide with browser defaults.

## Phase 9: Testing and Verification
- Add smoke tests for global handler exposure and module load order.
- Write unit tests for evaluation progression, justification save, section grouping, and average calculation.
- Create integration tests for login + save + list evaluations with server running on `localhost:10000`.

## Deliverables
- Runtime fixes for handler exposure and duplicate function conflicts.
- Stable navigation gating and trait evaluation flow without errors.
- Local dev configuration that uses same-origin backend by default.
- Verified authentication and CSRF across all write endpoints.
- A small test suite to guard core flows.

## Rollout
- Implement Phase 1–3 first to stabilize UX and remove errors.
- Then apply Phase 4–6 for environment and persistence robustness.
- Close with Phase 7–9 for diagnostics, performance, accessibility, and tests.

## Acceptance Criteria
- No console ReferenceError/TypeError during the entire evaluation flow.
- Begin Evaluation is allowed only when required fields are filled; RS info optional unless logged in.
- Grade buttons, justification modal, review, directed comments, and summary all function.
- API calls target the intended backend (local vs Render) and succeed with CSRF.
- Sync queue operates and reflects status; errors are logged with user-friendly messages.
- Basic tests pass locally.