# Сайт Radiova

[English](README.md) | [Deutsch](README.de.md)

Цей репозиторій містить офіційний сайт **Radiova** – кросплатформного радіо-додатку.

Сайт публікується через GitHub Pages за адресою [radiova-app.github.io](https://radiova-app.github.io).

## Стек

- [Astro](https://astro.build) – генератор статичних сайтів
- TypeScript (strict mode)
- SCSS для стилізації
- ESLint + Prettier для якості коду
- Vitest для тестування
- GitHub Actions для CI/CD

## Локальна розробка

```bash
npm install
npm run dev
```

Сервер запускається за адресою **http://localhost:4321** за замовчуванням.

- Зміни у файлах `.astro`, `.ts` та `.scss` застосовуються автоматично через HMR – не потрібно перезбирати.
- Усі три мови (EN, UK, DE) доступні під час розробки.
- Натисніть `Ctrl+C`, щоб зупинити сервер.
- `npm run dev:host` запускає сервер у локальній мережі (для тестування з телефона або іншого ПК).
- `npm run dev:open` запускає сервер і відкриває браузер автоматично.

### Перевірка production-збірок

```bash
# Звичайна збірка > dist/
npm run build
npm run preview

# Збірка для GitHub Pages > docs/
npm run build:prod
npm run preview:prod
```

- `npm run preview` показує `dist/` через вбудований сервер Astro.
- `npm run preview:prod` показує `docs/` через легкий Node.js static server.
- Сервер розробки не є production-хостингом.

## Тести

```bash
npm test
```

## Структура проєкту

```
.
├── .github/workflows/   # CI/CD
├── public/              # Статичні файли
├── scripts/             # Допоміжні скрипти збірки
├── src/
│   ├── components/      # Перевикористовувані компоненти
│   ├── layouts/         # Макети сторінок
│   ├── pages/           # Сторінки (en, de, uk)
│   ├── services/        # API сервіси
│   ├── styles/          # SCSS токени та глобальні стилі
│   ├── types/           # TypeScript типи
│   └── config/          # Конфігурація сайту
├── tests/               # Тестові файли
└── ...файли конфігурації
```

## Публікація на GitHub Pages

Сайт автоматично публікується на GitHub Pages при кожному push у гілку `main` через `.github/workflows/deploy.yml`.

## Пов'язані репозиторії

- [radiova-releases](https://github.com/radiova-app/radiova-releases) – артефакти збірок та метадані релізів

## Статус проєкту

Проєкт на ранній стадії розробки. Структура сайту налаштовується, релізи ще не доступні.
