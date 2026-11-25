# Pokelike Bot – Arbeitsregeln für Claude

Browser-Erweiterung (Chrome MV3) und Userscript, die https://pokelike.xyz autonom spielen. Einstieg: `README.md`.

## Quellen der Wahrheit

- `docs/REQUIREMENTS.md` (was gebaut wird) und `docs/PROGRESS.md` (Stand der Umsetzung) sind die **einzige Quelle der
  Wahrheit**. Jeder Plan, auch jeder aus dem Superpowers-Workflow, nennt die betroffenen Anforderungen (z. B. R4.2) und
  hält beide Dateien aktuell: neue Anforderungen zuerst in `REQUIREMENTS.md`, Ergebnisse nach jeder Aufgabe in `PROGRESS.md`.
  Eigene Plandateien ersetzen diese Dateien nicht.
- Weitere Referenzen: `docs/GAME_RECON.md` (Spielmechanik, Bildschirme), `docs/STRATEGY.md` (Simulation, Messwerte),
  `docs/UI.md` (Oberfläche und Design-Prozess).

## Plugins und Workflow

- **Superpowers** für jede größere Aufgabe: Brainstorming → Plan → TDD → Reviews durch Subagents. Kleine, eindeutige
  Änderungen dürfen direkt erfolgen.
- **frontend-design** für jede Arbeit an der Oberfläche (Overlay, Einstellungsformular, Toasts, Popup, Optionsseite),
  immer zusammen mit dem Design-Prozess aus `docs/UI.md`.
- **Keine Plugins, Hooks oder Skills**, die Gedächtnis- oder Anforderungsdateien (`CLAUDE.md`, `docs/REQUIREMENTS.md`,
  `docs/PROGRESS.md`, Memory-Dateien) automatisch kürzen, zusammenfassen oder umschreiben. Änderungen daran nur gezielt
  und nachvollziehbar.

## Unverhandelbare Regeln (Details: REQUIREMENTS R5)

- Nie Pokédollar ausgeben (Shop, Eier, Vitamine) ohne ausdrückliche Bestätigung des Nutzers.
- Nie in den localStorage des Spiels schreiben, keine Spielfunktionen patchen. Ausnahmen stehen in R5.2.
- Simulationen nur mit eigenen Seeds; echte Zufallsergebnisse nie vorhersagen.
- Nie private Spielstände oder Tokens committen.
- Unbekannter Bildschirm ⇒ pausieren, nie raten.

## Befehle

- `npm run build` · `npm test` · `npm run e2e` · `npx tsc --noEmit -p .` · `npx eslint src tests` · `npx prettier --write src tests`
- Live-Test: `LIVE=1 LIVE_MINUTES=30 LIVE_MODE=challenge LIVE_CHAL=arena npx playwright test tests/e2e/live.spec.ts --trace off`
