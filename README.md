# Radiova Website

[Українською](README.uk.md) | [Deutsch](README.de.md)

This repository contains the official website for **Radiova** – a cross-platform radio app.

The site is published via GitHub Pages at [radiova-app.github.io](https://radiova-app.github.io).

## Tech Stack

- [Astro](https://astro.build) – static site generator
- TypeScript (strict mode)
- SCSS for styling
- ESLint + Prettier for code quality
- Vitest for testing
- GitHub Actions for CI/CD

## Local Development

```bash
npm install
npm run dev
```

The dev server starts at **http://localhost:4321** by default.

- Changes in `.astro`, `.ts`, and `.scss` files are applied automatically via HMR – no need to rebuild.
- All three languages (EN, UK, DE) are available during development.
- Press `Ctrl+C` to stop the server.
- `npm run dev:host` starts the server on your local network (useful for testing from a phone or another PC).
- `npm run dev:open` starts the dev server and opens the browser automatically.

### Preview production builds

```bash
# Default build > dist/
npm run build
npm run preview

# GitHub Pages build > docs/
npm run build:prod
npm run preview:prod
```

- `npm run preview` serves `dist/` via Astro's built-in preview server.
- `npm run preview:prod` serves `docs/` via a lightweight Node.js static server.
- The dev server is not a production hosting solution.

## Tests

```bash
npm test
```

## Project Structure

```
.
├── .github/workflows/   # CI/CD
├── public/              # Static assets
├── scripts/             # Build helper scripts
├── src/
│   ├── components/      # Reusable components
│   ├── layouts/         # Page layouts
│   ├── pages/           # Route pages (en, de, uk)
│   ├── services/        # API services
│   ├── styles/          # SCSS tokens and globals
│   ├── types/           # TypeScript types
│   └── config/          # Site configuration
├── tests/               # Test files
└── ...config files
```

## GitHub Pages Deployment

The site is automatically deployed to GitHub Pages on every push to the `main` branch via `.github/workflows/deploy.yml`.

## Related Repositories

- [radiova-releases](https://github.com/radiova-app/radiova-releases) – build artifacts and release metadata

## Project Status

This project is in early development. The website structure is being set up, and no production release is available yet.
