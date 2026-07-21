# Radiova-Website

[English](README.md) | [Українською](README.uk.md)

Dieses Repository enthält die offizielle Website für **Radiova** – eine plattformübergreifende Radio-App.

Die Website wird über GitHub Pages unter [radiova-app.github.io](https://radiova-app.github.io) veröffentlicht.

## Technologien

- [Astro](https://astro.build) – Static-Site-Generator
- TypeScript (strict mode)
- SCSS für Styling
- ESLint + Prettier für Codequalität
- Vitest für Tests
- GitHub Actions für CI/CD

## Lokale Entwicklung

```bash
npm install
npm run dev
```

Der Dev-Server startet unter **http://localhost:4321**.

- Änderungen an `.astro`-, `.ts`- und `.scss`-Dateien werden automatisch per HMR übernommen – kein erneuter Build erforderlich.
- Alle drei Sprachen (EN, UK, DE) sind während der Entwicklung verfügbar.
- Drücken Sie `Ctrl+C`, um den Server zu stoppen.
- `npm run dev:host` startet den Server im lokalen Netzwerk (zum Testen auf dem Handy oder einem anderen PC).
- `npm run dev:open` startet den Dev-Server und öffnet den Browser automatisch.

### Production-Builds testen

```bash
# Standard-Build > dist/
npm run build
npm run preview

# GitHub-Pages-Build > docs/
npm run build:prod
npm run preview:prod
```

- `npm run preview` zeigt `dist/` über den integrierten Astro-Server an.
- `npm run preview:prod` zeigt `docs/` über einen einfachen Node.js-Static-Server an.
- Der Dev-Server ist kein Production-Hosting.

## Tests

```bash
npm test
```

## Projektstruktur

```
.
├── .github/workflows/   # CI/CD
├── public/              # Statische Assets
├── scripts/             # Build-Hilfsskripte
├── src/
│   ├── components/      # Wiederverwendbare Komponenten
│   ├── layouts/         # Seitenlayouts
│   ├── pages/           # Routenseiten (en, de, uk)
│   ├── services/        # API-Dienste
│   ├── styles/          # SCSS-Tokens und globale Styles
│   ├── types/           # TypeScript-Typen
│   └── config/          # Seitenkonfiguration
├── tests/               # Testdateien
└── ...Konfigurationsdateien
```

## GitHub Pages Deployment

Die Website wird bei jedem Push in den `main`-Branch automatisch über `.github/workflows/deploy.yml` auf GitHub Pages bereitgestellt.

## Verwandte Repositories

- [radiova-releases](https://github.com/radiova-app/radiova-releases) – Build-Artefakte und Release-Metadaten

## Projektstatus

Dieses Projekt befindet sich in der frühen Entwicklung. Die Website-Struktur wird aufgebaut, es ist noch keine Produktionsversion verfügbar.
