# Radiova Branding

## Canonical source

The official public-site logo is read from the private, read-only source:

`../radiova-platform-private/packages/branding/originals/active.png`

It is a 128x128 transparent PNG. SHA-256:

`f72df72370fcc1bbc92309f0e11d45576af798b14bfb0a23807f33b14f94e883`

The symbol must not be redrawn, traced, replaced with an SVG, or substituted with text, Unicode, an emoji, or an icon font.

## Reference-only files

`icons.png` and all `*_icon.png` files in the canonical directory are visual references. They contain opaque backgrounds and are not runtime assets.

## Generation

Run `npm run branding:sync` from the public repository. The script verifies the canonical source, preserves transparency and aspect ratio, adds safe transparent padding where required, and writes deterministic PNG assets under:

- `public/assets/branding/`
- `public/icons/`

`public/assets/branding/branding-manifest.json` records the canonical filename, SHA-256, dimensions, and generated outputs. Generated public files are never the source of truth.

## Placement

- Desktop uses the official logo in the sidebar brand.
- Mobile uses the same logo beside the Radiova name in the topbar.
- Home does not add a second logo/title row below the topbar.
