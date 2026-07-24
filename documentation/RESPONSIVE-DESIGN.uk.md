# Адаптивний дизайн

## Shell

На desktop `shell-body` має дві явні колонки: sidebar і content `minmax(0, 1fr)`. Backdrop глобально прихований і не бере участі в desktop grid. На ширині 640px і менше sidebar стає fixed off-canvas drawer, content займає весь viewport, а document scrolling замінює вкладені rails сторінок.

Drawer закривається кліком по backdrop, Escape, переходом за route та поверненням до desktop. Body scroll lock і `aria-expanded` синхронізовані зі станом drawer.

## Розміщення плеєра

Home routes (`/`, `/uk/`, `/de/`) показують великий dashboard player і приховують compact player. Інші routes містять один compact-player DOM view, підключений до persistent audio. Вище 860px він займає player area у topbar. На 860px і менше переходить у другий повноширинний рядок topbar.

## Dashboard і secondary pages

Dashboard використовує content container query, щоб сховати боковий visualizer до звуження основної колонки. На mobile player, tabs, search і station list ідуть одним document-flow стовпцем. Tabs прокручуються горизонтально, усі actions залишаються доступними.

Secondary pages займають всю доступну ширину з mobile padding 16px. Card grids використовують `minmax(min(280px, 100%), 1fr)`, тому viewport 320px не переповнюється.

## Перевірка consent

Виконайте `npm run build`, потім `npm run verify:responsive-branding`. Browser verifier перевіряє unknown, accepted і private modes із deterministic station/audio fixtures, дев’ять viewports, десять routes, decoded branding images, drawer behavior, horizontal overflow і persistent playback navigation.
