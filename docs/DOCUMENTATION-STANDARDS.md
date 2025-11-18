# Documentation Standards

This project enforces high-quality, maintainable documentation across code and architecture. These standards define inline documentation requirements, complex logic annotations, maintenance processes, and quality controls.

## 1. Inline Documentation Requirements
- Use JSDoc-style comments above all functions, classes, and methods.
- Document each parameter with `@param {Type} name` and a concise description, including constraints.
- Specify return values with `@returns {Type}` and note possible values or shapes.
- Include `@throws` tags for all possible error conditions and when errors are propagated.
- Maintain consistent formatting:
  - 80-character line length target for comment text
  - Uniform indentation aligned with surrounding code
  - Prefer sentence case and grammatically correct language
- Include example usage, sample inputs/outputs for critical functions.

## 2. Complex Logic Documentation
- Divide complex algorithms into clearly marked sections with descriptive headers.
- Provide pseudocode or mathematical formulas where applicable.
- Document performance characteristics (time/space complexity) and any trade-offs.
- Include decision rationale for non-obvious implementation choices.
- Reference external specifications with version numbers and sections (e.g., RFCs, API docs).
- Add example scenarios covering normal cases and edge conditions.

## 3. Documentation Maintenance Process
- Automated checks enforce JSDoc presence and correctness via ESLint rules.
- Documentation is reviewed during code reviews using the checklist in `docs/REVIEW-CHECKLIST.md`.
- Use `TODO:` and `FIXME:` tags with assignee and target date (e.g., `TODO(Owner, 2025-01-31): ...`).
- Update the documentation changelog in `docs/DOCS_CHANGELOG.md` for significant changes.
- Follow the Documentation Update Checklist before merging code modifications.

## 4. Quality Control Standards
- Enforce professional, grammatically correct language.
- Verify technical accuracy against implementation; keep docs synchronized.
- Use consistent terminology and cross-reference related modules/files.
- Maintain documentation coverage metrics (minimum 90% JSDoc coverage of functions/methods).
- Add visual diagrams (Mermaid) for complex components and data flows.
- Include sample inputs/outputs for key functions and APIs.
- Document thread safety and concurrency considerations (e.g., shared caches, request handling).

## 5. Visual Diagrams
- Prefer Mermaid diagrams placed in `docs/ARCHITECTURE.md`.
- Include sequence diagrams for critical flows (e.g., login, evaluation load/save).
- Keep diagrams updated when flows change.

## 6. Terminology
- Use consistent naming across frontend and backend (e.g., "evaluation", "profile", "RS").
- Mirror API route names with frontend call wrappers.

## 7. Examples

Example function JSDoc:

```js
/**
 * Calculate average grade for traits.
 *
 * @param {Array<{gradeNumber: number}>} traits - List of trait grades.
 * @returns {number} Average (0–5). Returns NaN for empty list.
 * @throws {TypeError} When `traits` is not an array.
 */
function avgTrait(traits) { /* ... */ }
```

Example pseudocode block:

```text
Algorithm: LoadEvaluations
1. Fetch index file from data repository
2. For each entry, request detail file in parallel
3. Decode and parse YAML to normalized JSON structure
4. Aggregate and return sorted evaluation list
Time: O(n) requests; Space: O(n) for results
```

