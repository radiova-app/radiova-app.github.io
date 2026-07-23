# Radiova-Website

[English](README.md) | [Українською](README.uk.md)

Der öffentliche Radiova-Player ist eine statische Astro-Website und installierbare PWA. Das Design orientiert sich am Extension-Dashboard; die Produktionsadresse ist [radiova-app.github.io](https://radiova-app.github.io).

## Entwicklung und Prüfung

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

Der lokale Server läuft unter `http://localhost:4321`. Mit `npm run dev:host` kann er im lokalen Netzwerk getestet werden. Der Produktions-Build wird in `dist/` erstellt.

## Playlist-Quellen

Die Website lädt Laufzeitdaten aus dem öffentlichen Repository [radiova-stations](https://github.com/radiova-app/radiova-stations): das Manifest `generated/playlists-manifest.json` sowie die M3U-Playlists `uk`, `en`, `de`, `global` und `all`.

Zuerst wird das Manifest und danach nur die ausgewählte Playlist geladen. M3U-Inhalte werden validiert, SHA-256 wird bei Verfügbarkeit geprüft und die letzte gültige Kopie bleibt für die Offline-Nutzung erhalten. Playlist-Updates erfordern keinen Website-Build.

## Lokale Daten

Alle Nutzerdaten bleiben im Browser:

- IndexedDB: Favoriten, zuletzt gehörte Sender, Playlist-Cache und eigene Playlists
- local storage: Lautstärke, Stummschaltung und gewählte Sprache

Eigene Playlists lassen sich erstellen, umbenennen, löschen, aus M3U importieren und nach M3U exportieren. Die Privacy-Seite bietet eine bestätigte Aktion zum Zurücksetzen lokaler Daten.

## PWA

Die Website enthält Manifest, Service Worker, Offline-App-Shell-Cache und maskierbare Icons. In Chromium erscheint die Installationsaktion nach `beforeinstallprompt`.

Öffnen Sie die Website auf iPhone oder iPad in Safari, wählen Sie **Teilen** und dann **Zum Home-Bildschirm**. Safari bietet keinen Chromium-Installationsdialog.

Audiostreams werden nicht zwischengespeichert. Falls CORS eines Senders die Audioanalyse verhindert, läuft die Wiedergabe mit einem statischen Visualizer-Fallback weiter.

## GitHub Pages

`.github/workflows/deploy.yml` führt Check, Lint, Tests und Build aus und veröffentlicht anschließend `dist/` nur nach einem Push auf `main` oder einem manuellen Workflow-Start. Lokale Befehle führen kein Deployment aus.

Die Migration der Extension auf das gemeinsame Remote-Manifest ist als separates Follow-up geplant und Teil dieser Änderungen nicht.
