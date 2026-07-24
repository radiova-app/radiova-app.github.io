# Hinweis zum Repository

[English](REPOSITORY.md) | [Українська](REPOSITORY_UK.md) | Deutsch

Dieses Repository enthält nur generierte GitHub-Pages-Ausgabe.
Quelle der Wahrheit: `radiova-platform-private/apps/web`
Veröffentlichte Ausgabe: `docs/`

Dateien in docs/ nicht manuell bearbeiten. Sie werden durch den Production-Build des privaten Monorepos erzeugt.

## Zweck

Dieses Repository veröffentlicht die öffentliche Radiova-Website.
Es enthält die generierte Website, die öffentliche Dokumentation und den GitHub-Pages-Workflow.

## Deployment-Ablauf

1. Die Website im privaten Monorepo bauen.
2. Die generierte Ausgabe nach `docs/` kopieren.
3. Das öffentliche Repository committen.
4. GitHub Pages liefert `docs/` aus.

## Was hier hingehört

- generiertes `docs/`
- öffentliche Repository-Dokumentation
- Workflow und Vorlagen für das Repository

## Was hier nicht hingehört

- Quellcode
- Package-Dateien
- Build-Abhängigkeiten
- lokale Build-Caches
- manuelle Änderungen an `docs/`

## Erwarteter Git-Status nach einer Production-Kopie

- `docs/` muss den neuesten veröffentlichten Stand zeigen.
- Keine Quellcode-Verzeichnisse dürfen zurückkehren.
- Keine Package- oder Build-Dateien dürfen vorhanden sein.
- Die Dokumentation muss mit der Deployment-only-Rolle konsistent bleiben.
