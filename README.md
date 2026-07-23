# Radiova Website

[Українською](README.uk.md) | [Deutsch](README.de.md)

The public Radiova radio player is a static Astro website and installable PWA. It is designed around the Radiova extension dashboard and is published at [radiova-app.github.io](https://radiova-app.github.io).

## Development

```bash
npm install
npm run dev
```

The development server runs at `http://localhost:4321`. Use `npm run dev:host` to test from another device on the local network.

## Verification

```bash
npm run check
npm run lint
npm test
npm run build
npm run preview
git diff --check
```

`npm run build` creates the deployable static site in `dist/`. `npm run preview` serves that production build locally.

## Playlist Sources

Default playlists are read at runtime from the public [radiova-stations](https://github.com/radiova-app/radiova-stations) repository:

- `generated/playlists-manifest.json`
- `playlists/uk.m3u`
- `playlists/en.m3u`
- `playlists/de.m3u`
- `playlists/global.m3u`
- `playlists/all.m3u`

The browser loads the manifest before a selected playlist, validates the M3U content, verifies the manifest SHA-256 when available, and retains the last valid cached copy for offline use. Playlist updates therefore do not require rebuilding the website.

## Local Data

Radiova keeps user data in the browser only:

- IndexedDB: favorites, recently played stations, cached remote playlists, and custom playlists
- local storage: player volume, mute state, and selected language

Custom playlists can be created, renamed, deleted, imported from M3U, and exported as M3U. Imported playlists keep complete station and endpoint data so they remain exportable. The Privacy page has a confirmed **Reset local data** action.

## PWA

The site includes a web app manifest, service worker, offline app shell cache, and maskable icons. Chromium-family browsers show the in-app install action after `beforeinstallprompt` becomes available.

On iPhone or iPad, open the site in Safari, choose **Share**, then **Add to Home Screen**. Safari does not provide Chromium's install prompt.

Audio playback is not cached. Audio analysis for the equalizer can be blocked by a station's CORS policy; playback continues with a static visualizer fallback.

## Download Configuration

`public/config/downloads.json` records the status and future URLs for PWA, browser extensions, and native applications. Keep unavailable release URLs empty until a real distribution exists.

## GitHub Pages

`.github/workflows/deploy.yml` runs checks, linting, tests, and `npm run build`, then uploads `dist/` to GitHub Pages. The workflow deploys only after a push to `main` or a manual GitHub Actions dispatch. This repository does not deploy automatically from local development commands.

`astro.config.mjs` uses the root production URL `https://radiova-app.github.io`, so manifest and service-worker paths are root-relative for the organization site.

## Scope

The public website and the extension share public playlist formats, but extension migration is intentionally deferred to a separate follow-up. Website code must not depend on extension-only APIs.
