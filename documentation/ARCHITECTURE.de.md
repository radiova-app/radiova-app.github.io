# Architektur

## Quelltext-Struktur

| Verzeichnis | Zweck |
|---|---|
| `src/services/` | Beständiger Zustand, reine Logik, keine DOM-Abhängigkeiten |
| `src/scripts/` | Seiten-spezifische UI-Logik (läuft einmal pro Seiten-Lebenszyklus) |
| `src/visualizer/` | Zustandsloses Canvas-Rendering |
| `src/shared/` | Konstanten, DOM-Helfer, Icon-Strings — zwischen Skripten geteilt |

## Architektur-Regeln

**Graph überlebt Views.** Der Web-Audio-Graph (`src/services/audio-graph.ts`)
wird einmal beim ersten Einbinden des Equalizers erzeugt und bleibt bei
Seitennavigation bestehen. Es werden nur Canvas-Referenzen (View-Ebene)
neu gebunden. Der Graph wird nur bei `pagehide` getrennt — niemals während
der Navigation.

**Einzelner RAF-Zyklus.** Ein `requestAnimationFrame`-Callback (`tick` in
`src/scripts/equalizer.ts`) sammelt Frequenzdaten, berechnet Pegel, aktualisiert
Meter-DOM-Elemente und zeichnet auf Canvas. Ein zweiter, paralleler Zyklus wird
nie gestartet. Abklingen nach Pause verwendet denselben Zyklus kurz und stoppt dann.

**Visualisierungsfehler unterbrechen niemals die Audiowiedergabe.** Fehlende
Canvases, Null-Kontexte, stille AnalyserNodes oder Ausnahmen im Zeichencode
verschlechtern stumm die visuelle Ausgabe. Das Audio läuft ungestört weiter.

**Ein <audio>-Element erhält einen MediaElementAudioSourceNode.** Ein zweiter
Source auf demselben Element löst einen Fehler aus. Die Absicherung in
`ensureGraph` lehnt eine Elementänderung still ab, statt neu aufzubauen.

## Modul-Verantwortlichkeiten

| Modul | Verantwortlichkeit |
|---|---|
| `src/services/audio-graph.ts` | Einzelinstanz von AudioContext, MediaElementAudioSourceNode, GainNode, ChannelSplitterNode, zwei AnalyserNodes. Verbinden/Trennen-Lebenszyklus. |
| `src/services/level-meter.ts` | Reine Funktionen: `clampLevel`, `calculateLevelFromTimeDomainData`, `smoothLevel` (schneller Angriff, langsamer Abfall), `maxBin`, `meterTarget`, `readAnalyserLevel`. |
| `src/services/player.ts` | Beständiges `<audio>`, Medienereignisbehandlung, Wiedergabe-Zustandsmaschine, Lautstärke-/Stummschaltungs-Persistenz. |
| `src/services/consent.ts` | Consent/Cookie-Modal, Sprachumschalter vor Consent. Zustand + UI in einem Modul. |
| `src/services/db.ts` | IndexedDB-Wrapper für Offline-Sender-Metadaten. |
| `src/services/playlist.ts` | CRUD für benutzerdefinierte Playlists (IndexedDB). |
| `src/services/pwa.ts` | Service-Worker-Registrierung, Installationsaufforderung. |
| `src/services/releases.ts` | Abruf von GitHub-Releases-Metadaten. |
| `src/services/reporter.ts` | Fehler-/Zustandsberichterstattung. |
| `src/services/i18n.ts` | Laufzeit-Sprachumschaltung. |
| `src/services/m3u.ts` | M3U-Playlist-Parser. |
| `src/scripts/equalizer.ts` | Integrationsschicht: verbindet audio-graph + level-meter + canvas-renderer. Besitzt RAF-Zyklus, Meter-Zustand, Debug-Zustand, `EqMode`. Exportiert `createEqualizer`, `createSideVisualizer`. |
| `src/scripts/app.ts` | Player-UI, Senderauswahl, Stream-Timeout/Fallback, PWA-Installation, Seitenleiste, Lautstärkesynchronisation. |
| `src/scripts/dashboard.ts` | Senderliste, Paginierung, Suche, Favoriten, Tabs. |
| `src/scripts/playlists.ts` | UI für benutzerdefinierte Playlists. |
| `src/visualizer/canvas-renderer.ts` | Zustandsloses Zeichnen: `drawBars`, `drawSide`, `drawStaticCanvas`, `resizeCanvasToDisplaySize`, `getCtx`. |
| `src/shared/constants.ts` | Ereignisnamen (`EVENTS.*`), Speicherschlüssel (`STORAGE.*`), magische Zahlen, DOM-Selektoren (`SELECTORS.*`). |
| `src/shared/icons.ts` | SVG-Pfad-Konstanten, Icon-Wrapper-Funktionen. |
| `src/shared/dom.ts` | DOM-Helfer: `$`, `escapeHtml`, `iconForStatus`, `isLoadingStatus`, `safeArtworkUrl`, `dispatch`, `listen`. |
