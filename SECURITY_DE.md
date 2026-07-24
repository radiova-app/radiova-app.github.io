# Sicherheitsrichtlinie

[English](SECURITY.md) | [Українська](SECURITY_UK.md) | Deutsch

Dieses Repository enthält nur generierte GitHub-Pages-Ausgabe.
Quelle der Wahrheit: `radiova-platform-private/apps/web`
Veröffentlichte Ausgabe: `docs/`

Dateien in docs/ nicht manuell bearbeiten. Sie werden durch den Production-Build des privaten Monorepos erzeugt.

## Was als Sicherheitsproblem zählt

- Browser- oder PWA-Schwachstellen auf der öffentlichen Website
- Service-Worker- oder Cache-Verhalten mit möglichem Datenabfluss
- Datenschutzprobleme bei Consent oder Browser-Speicher
- unsichere Offenlegung von Website-Inhalten oder Metadaten

## Was kein Sicherheitsproblem ist

- defekte Streams von Drittanbietern
- Playlist-Inhaltsfehler ohne Sicherheitswirkung
- normale Browserfehler ohne Datenabfluss
- Funktionswünsche

## Meldung einer Schwachstelle

Bitte Sicherheitslücken nicht über öffentliche GitHub Issues melden.

Nutzen Sie GitHub Private Vulnerability Reporting:

1. Öffnen Sie den Security-Tab dieses Repositories.
2. Wählen Sie Report a vulnerability.
3. Geben Sie die betroffene Seite, den Browser, die Reproduktionsschritte, die Auswirkung und ggf. Screenshots oder Konsolenausgaben an.

Wenn die Option Report a vulnerability nicht verfügbar ist, veröffentlichen Sie die Details nicht öffentlich. Kontaktieren Sie den Maintainer über einen vorhandenen privaten Kanal und bitten Sie um einen sicheren Meldeweg.

Bitte kurze Beschreibung, betroffene Seite, Browser und ob das Problem im privaten Fenster reproduzierbar ist.

## Geltungsbereich

Der unterstützte Bereich ist die öffentliche Website und ihre generierten Artefakte.
Drittanbieter-Radiosender liegen nicht vollständig unter unserer Kontrolle, aber das Website-Verhalten rund um sie ist im Scope.

Private Vulnerability Reporting ist der bevorzugte Meldeweg, wenn verfügbar.

## Status

READY für die Prüfung des Meldewegs durch Maintainer.
