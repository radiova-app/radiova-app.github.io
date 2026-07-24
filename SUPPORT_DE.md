# Support

[English](SUPPORT.md) | [Українська](SUPPORT_UK.md) | Deutsch

Dieses Repository enthält nur generierte GitHub-Pages-Ausgabe.
Quelle der Wahrheit: `radiova-platform-private/apps/web`
Veröffentlichte Ausgabe: `docs/`

Dateien in docs/ nicht manuell bearbeiten. Sie werden durch den Production-Build des privaten Monorepos erzeugt.

## Vor einer Meldung

- Seite hart neu laden.
- Einen anderen Browser testen.
- Website-Daten löschen, wenn die App hängt.
- Für Wiedergabe- oder Speicherprobleme sicherstellen, dass Consent akzeptiert wurde.

## PWA-Installation

- Chromium-Browser: Installationsbutton verwenden, wenn er erscheint.
- iPhone und iPad: Safari öffnen, dann Share > Add to Home Screen.
- Firefox und Safari auf dem Desktop verhalten sich eventuell anders als Chromium.

## Audio und Visualizer

- Wenn Audio nicht startet, Sender und Browser angeben.
- Der Visualizer kann durch CORS-Header des Streams eingeschränkt sein.
- Ein Sender kann laufen, auch wenn der Visualizer statisch bleibt.

## Website-Daten löschen

Wenn Wiedergabe, Sprache oder Consent merkwürdig reagieren, die Website-Daten für die Domain löschen und neu laden.

## Defekte Sender

Die Issue-Vorlage für defekte Sender verwenden und angeben:

- Sendername
- Seite oder Playlist
- Stream-URL, falls bekannt
- Browser und Gerät
- Uhrzeit des Fehlers
- ob ein Fallback-Stream oder visueller Zustand funktioniert hat

## Nützliche Links

- Help: <https://radiova-app.github.io/help/>
- Privacy: <https://radiova-app.github.io/privacy/>
- Sicherheitsproblem melden: siehe `SECURITY.md`
