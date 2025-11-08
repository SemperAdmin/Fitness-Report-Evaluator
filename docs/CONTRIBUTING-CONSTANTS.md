# Constants Contribution Guidelines

Goals
- Prevent magic numbers and hardcoded strings in new code.
- Keep the constants module clear, consistent, and extensible.

Naming Convention
- Use `UPPER_SNAKE_CASE` for constant names (e.g., `ACCOUNT_LOGIN`, `MODAL_ANIMATION_MS`).
- Group related constants under logical categories: `API_CONFIG`, `ROUTES`, `UI_SETTINGS`, `ERROR_MESSAGES`, `STATUS_MESSAGES`, `MODAL_CONFIG`.

Documentation Requirements
- Every constant must include a brief JSDoc/TSDoc comment covering:
  - Purpose and usage context
  - Expected types (string, number, object)
  - Value ranges or examples where relevant
  - Any business logic dependencies

Type Safety
- Use JSDoc typedefs to specify shapes of grouped constants.
- When TypeScript is introduced, mirror these types in `.d.ts` or `*.ts`.

Deprecation Procedures
- Mark deprecated constants with a JSDoc `@deprecated` tag, explaining the replacement.
- Avoid removing immediately; keep for one release cycle if feasible.
- Update all references in code and tests; add an entry to `CHANGELOG.md` when applicable.

Code Review Checklist
- Are new features using constants instead of literals?
- Are constants placed in the correct category?
- Is naming consistent with `UPPER_SNAKE_CASE`?
- Is documentation present and clear?
- Are existing constants reused where possible?

Linting & Prevention
- ESLint rule `no-magic-numbers` is enabled to discourage numeric literals.
- For hardcoded strings, prefer constants. Consider adding `eslint-plugin-no-literal-string` in dev environments for stricter enforcement.

