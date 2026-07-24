# Responsive Design

## Shell

Desktop uses two explicit shell-body columns: sidebar and `minmax(0, 1fr)` content. The backdrop is globally hidden and never participates in the desktop grid. At 640px and below the sidebar becomes a fixed off-canvas drawer, the content uses the full viewport, and document scrolling replaces nested page rails.

The drawer closes on backdrop click, Escape, route selection, and a switch back to desktop. Body scroll lock and `aria-expanded` follow the drawer state.

## Player placement

Home routes (`/`, `/uk/`, `/de/`) show the full dashboard player and hide the compact player. Other routes contain one compact-player DOM view connected to the persistent audio element. Above 860px it occupies the topbar player area. At 860px and below it moves to a full-width second topbar row.

## Dashboard and secondary pages

The dashboard uses a content container query to remove the side visualizer before the main column becomes too narrow. Mobile uses one document-flow column for player, tabs, search, and station list. Tabs scroll horizontally and controls retain their actions.

Secondary pages use the full available width with 16px mobile padding. Card grids use `minmax(min(280px, 100%), 1fr)` so 320px viewports do not overflow.

## Consent verification

Run `npm run build` followed by `npm run verify:responsive-branding`. The browser verifier covers unknown, accepted, and private modes with deterministic station/audio fixtures, nine viewports, ten routes, decoded branding images, drawer behavior, horizontal overflow, and persistent playback navigation.
