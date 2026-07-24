# TSDoc Policy

## Which APIs require TSDoc

Every **public API** must have a `/** ... */` comment:

- exported functions and arrow functions
- exported classes
- exported interfaces and type aliases
- exported constants (`export const`)

**Private** (non-exported) declarations do **not** require TSDoc.

## Required tags

| Tag | Required for |
|---|---|
| `@param` | Every function parameter (except destructured) |
| `@returns` | Every function with a non-`void` return |
| `@throws` | Document known exceptions |
| `@internal` | Mark APIs not meant for external use |
| `@remarks` | Additional context (optional) |
| `@example` | Usage example (optional) |

Do **not** add type annotations in `@param` or `@returns` — TypeScript already provides types.
Do **not** add redundant descriptions where the name and type are self-explanatory.

## Style

```ts
/**
 * Short description. Longer explanation on the next line if needed.
 * @param paramName - Description of the parameter.
 * @returns Description of the return value.
 */
```

- Use `-` between the tag name and its description.
- Omit tags for self-documenting parameters (e.g. a `url: string` parameter called `url` with a clear purpose).
- Prefer `@internal` over relying on the `publicOnly` filter.

## How to check

```bash
npm run lint          # runs all ESLint rules including TSDoc
npm run lint:docs     # same check (alias for src/**)
npx eslint src/       # explicit scope
```

## Exceptions

- Test files (`tests/`) are exempt from all TSDoc rules.
- Configuration files (`eslint.config.js`, `astro.config.mjs`) are exempt.
- Internal helpers marked `@internal` are exempt from `@param`/`@returns`.
- `arrow-function-expressions`, `function-expressions`, `class-expressions`, and `method-definitions` are excluded from `require-jsdoc`.

## Test documentation policy

Tests need more context than production code because they encode edge cases, browser limitations, and historical regressions that are not obvious from the test name alone.

### When to add comments

- **File headers** — every meaningful test file should start with a `/** ... */` block explaining the feature under test, the environment assumptions, major mocks, and related source modules.
- **Suite comments** — non-trivial `describe()` blocks should have a short comment when the suite name alone is insufficient.
- **Regression tests** — document the bug being prevented, citing the root cause or issue number when available.
- **Mocks and fixtures** — explain why the real implementation cannot be used in the unit test (e.g., "jsdom does not support IndexedDB").
- **Skipped tests** — every `.skip` must have a nearby comment explaining why it is skipped and what condition would allow enabling it.
- **Non-obvious assertions** — describe what the assertion proves, especially when it involves mathematical formulas, ordering constraints, or regex patterns.

### When to skip comments

- Trivial assertions that exactly match the test name.
- Syntax — never comment what the code does, only why it does it.
- Boilerplate that repeats the describe block summary.

### How to check

```bash
# Verify every .skip has a reason (structural test)
npx vitest run tests/test-documentation.test.ts
```

### Verification scripts

Scripts under `scripts/verify-*.mjs` require:
- A file-level `/** ... */` header.
- JSDoc on every helper function (`@param`, `@returns`).
- Clear documentation of environment assumptions (server URL, port, Playwright version).
- Explanation of what cleanup is performed and what happens on failure.
