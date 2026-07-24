# Брендинг Radiova

## Канонічне джерело

Офіційний логотип публічного сайту читається з приватного read-only джерела:

`../radiova-platform-private/packages/branding/originals/active.png`

Це прозорий PNG 128x128. SHA-256:

`f72df72370fcc1bbc92309f0e11d45576af798b14bfb0a23807f33b14f94e883`

Символ не можна перемальовувати, трасувати, замінювати SVG, текстом, Unicode, emoji чи icon font.

## Лише для звірки

`icons.png` та всі `*_icon.png` у канонічній директорії є візуальними референсами. Вони мають непрозоре тло й не використовуються як runtime assets.

## Генерація

У public-репозиторії виконайте `npm run branding:sync`. Скрипт перевіряє канонічне джерело, зберігає прозорість і пропорції, додає безпечні прозорі поля та детерміновано записує PNG у:

- `public/assets/branding/`
- `public/icons/`

`public/assets/branding/branding-manifest.json` містить canonical filename, SHA-256, dimensions і перелік outputs. Generated assets ніколи не є source of truth.

## Розміщення

- На desktop офіційний логотип розміщений у верхній частині sidebar.
- На mobile той самий логотип стоїть біля назви Radiova у topbar.
- Home не додає другий рядок logo/title під topbar.
