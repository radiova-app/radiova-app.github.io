# Архітектура

## Структура вихідного коду

| Директорія | Призначення |
|---|---|
| `src/services/` | Постійний стан, чиста логіка, без залежності від DOM |
| `src/scripts/` | Логіка UI сторінок (виконується один раз за життєвий цикл сторінки) |
| `src/visualizer/` | Малювання на canvas без стану |
| `src/shared/` | Константи, DOM-допоміжні функції, рядки іконок — спільне між скриптами |

## Архітектурні правила

**Граф переживає в'юхи.** Web Audio граф (`src/services/audio-graph.ts`)
створюється один раз при монтуванні першого еквалайзера і зберігається при
навігації між сторінками. Змінюються лише canvas-посилання (шар в'юхів).
Граф від'єднується лише на `pagehide` — ніколи під час навігації.

**Єдиний RAF-цикл.** Один `requestAnimationFrame`-колбек (`tick` в
`src/scripts/equalizer.ts`) обробляє збір частотних даних, обчислення рівнів,
оновлення DOM-метрів і малювання на canvas. Другий паралельний цикл ніколи не
запускається. Затухання після паузи використовує той самий цикл, потім зупиняється.

**Збій візуалізатора ніколи не перериває аудіо.** Відсутність canvas, null-контексти,
тихі AnalyserNode чи винятки в коді малювання погіршують візуальний вивід мовчки.
Аудіо продовжується безперебійно.

**Один `<audio>` елемент — один MediaElementAudioSourceNode.** Створення
другого джерела на тому ж елементі викидає виняток. Захист в `ensureGraph`
мовчки відхиляє зміну елемента замість перебудови.

## Відповідальність модулів

| Модуль | Відповідальність |
|---|---|
| `src/services/audio-graph.ts` | Одиничний AudioContext, MediaElementAudioSourceNode, GainNode, ChannelSplitterNode, два AnalyserNode. Підключення/відключення. |
| `src/services/level-meter.ts` | Чисті функції: `clampLevel`, `calculateLevelFromTimeDomainData`, `smoothLevel` (швидка атака, повільний спад), `maxBin`, `meterTarget`, `readAnalyserLevel`. |
| `src/services/player.ts` | Постійний `<audio>`, обробка медіа-подій, автомат стану відтворення, збереження гучності/вимкнення звуку. |
| `src/services/consent.ts` | Модалка згоди/cookie, перемикач мови до згоди. Стан + UI в одному модулі. |
| `src/services/db.ts` | Обгортка IndexedDB для офлайн-метаданих станцій. |
| `src/services/playlist.ts` | CRUD користувацьких плейлистів (IndexedDB). |
| `src/services/pwa.ts` | Реєстрація service worker, запит на встановлення. |
| `src/services/releases.ts` | Отримання метаданих релізів з GitHub. |
| `src/services/reporter.ts` | Звітування про помилки/стан. |
| `src/services/i18n.ts` | Перемикання мови під час роботи. |
| `src/services/m3u.ts` | Парсер M3U плейлистів. |
| `src/scripts/equalizer.ts` | Інтеграційний шар: об'єднує audio-graph + level-meter + canvas-renderer. Володіє RAF-циклом, станом метрів, станом налагодження, `EqMode`. Експортує `createEqualizer`, `createSideVisualizer`. |
| `src/scripts/app.ts` | UI плеєра, вибір станції, тайм-аут/фолбек потоку, встановлення PWA, бічна панель, синхронізація гучності. |
| `src/scripts/dashboard.ts` | Список станцій, пагінація, пошук, улюблені, вкладки. |
| `src/scripts/playlists.ts` | UI користувацьких плейлистів. |
| `src/visualizer/canvas-renderer.ts` | Малювання без стану: `drawBars`, `drawSide`, `drawStaticCanvas`, `resizeCanvasToDisplaySize`, `getCtx`. |
| `src/shared/constants.ts` | Назви подій (`EVENTS.*`), ключі сховища (`STORAGE.*`), магічні числа, DOM-селектори (`SELECTORS.*`). |
| `src/shared/icons.ts` | Константи SVG-шляхів, функції-обгортки іконок. |
| `src/shared/dom.ts` | DOM-утиліти: `$`, `escapeHtml`, `iconForStatus`, `isLoadingStatus`, `safeArtworkUrl`, `dispatch`, `listen`. |
