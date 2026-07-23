# Сайт Radiova

[English](README.md) | [Deutsch](README.de.md)

Публічний плеєр Radiova — це статичний сайт на Astro та PWA. Дизайн спирається на dashboard розширення; production-адреса: [radiova-app.github.io](https://radiova-app.github.io).

## Розробка та перевірка

```bash
npm install
npm run dev
npm run check
npm run lint
npm test
npm run build
npm run preview
git diff --check
```

Локальний сервер доступний за адресою `http://localhost:4321`. `npm run dev:host` відкриває його для інших пристроїв у локальній мережі. Production-збірка створюється в `dist/`.

## Джерела плейлистів

Сайт у runtime читає дані з публічного [radiova-stations](https://github.com/radiova-app/radiova-stations): manifest `generated/playlists-manifest.json` і плейлисти `uk`, `en`, `de`, `global`, `all` у форматі M3U.

Спочатку завантажується manifest, потім обраний плейлист. M3U перевіряється, SHA-256 звіряється за наявності, а остання коректна копія зберігається для offline-режиму. Оновлення плейлистів не потребує нової збірки сайту.

## Локальні дані

Усі користувацькі дані залишаються в браузері:

- IndexedDB: улюблені, нещодавні станції, кеш плейлистів, власні плейлисти
- local storage: гучність, mute та вибрана мова

Власні плейлисти можна створювати, перейменовувати, видаляти, імпортувати з M3U й експортувати в M3U. Сторінка Privacy має підтверджену дію скидання локальних даних.

## PWA

Є manifest, service worker, offline-кеш shell і maskable-іконки. У Chromium кнопка встановлення з'являється після `beforeinstallprompt`.

На iPhone або iPad відкрийте сайт у Safari, виберіть **Поділитися**, потім **На екран «Додому»**. Safari не показує Chromium install prompt.

Аудіопотоки не кешуються. Якщо CORS станції блокує аналіз аудіо, відтворення продовжується зі статичним fallback візуалізатора.

## GitHub Pages

`.github/workflows/deploy.yml` запускає check, lint, tests і build, після чого публікує `dist/` у GitHub Pages тільки після push у `main` або ручного запуску workflow. Локальні команди не виконують deploy.

Міграція extension на спільний remote manifest відкладена в окремий follow-up і не входить у зміни цього репозиторію.
