# Changelog

Alle nennenswerten Änderungen am Bot. Format nach [Keep a Changelog](https://keepachangelog.com/de/1.1.0/), Versionen nach [SemVer](https://semver.org/lang/de/). Die Version steht in `package.json` und wird in Manifest und Userscript übernommen (R-204, R-208).

## [Unreleased]

### Hinzugefügt

- `@updateURL`/`@downloadURL` im Userscript zeigen auf GitHub raw (`main/dist/…`). Sie funktionieren, sobald `dist/` zum Release eingecheckt ist (R-105, R-203).
- Fallback-Speicher des Userscripts: localStorage unter dem eigenen Präfix `pkbot.`, falls die GM-API fehlt oder scheitert. Die Einstellungen überleben dann auch ohne GM einen Reload (R-102).
- Automatische Checks:
  - Bundle- und Metadaten-Check beim Build und als `npm run check:userscript` (R-192, R-193)
  - Import-Grenzen `core/`/`ui/` ↔ `platform/` (R-032)
  - ESLint-Regel gegen stille Fehler (R-199)
  - `npm run check:docs` für die Gedächtnis-Dateien (R-246)
- Zentrale Fehlerablage `noteError` mit den letzten 50 verschiedenen Fehlern (R-199).
- E2E auf allen Viewports aus `docs/UI.md`: Desktop 1440×900, iPhone 390×844, iPhone mit Safari-Leisten, iPhone SE (R-005, R-033).
- Der SessionStart-Hook warnt vor nicht gemergten Remote-Branches (R-247).
- `docs/USERSCRIPT_API.md`: Abgleich der genutzten API mit Userscripts, Tampermonkey und Violentmonkey (R-098).

### Geändert

- Das Userscript nutzt nur noch die GM-Schnittmenge (`GM.getValue`, `GM.setValue`, `GM.setClipboard`). Die Legacy-APIs `GM_*` sind entfernt, und `@grant` wird aus der tatsächlichen Nutzung erzeugt (R-099, R-104).
- Die eingebettete Bridge ist lesbar und nicht mehr minifiziert. Userscript und Bridge zielen auf ES2020 (Safari ab iOS 15) (R-107).
- Der Live-Test wertet eine Fehler-Pause, etwa „action keeps failing“, als Fehlschlag (R-082).

### Behoben (Gesamt-Review P2)

- Scheitert im Userscript nur der GM-Schreibvorgang (etwa bei vollem Speicher), gilt nach einem Reload trotzdem die neueste Einstellung (R-100, R-102).
- Behandelte Fehler erscheinen als Warnung im Overlay-Log und im Log-Export (R-199).
- Der Bundle-Check erkennt RegExp-Lookbehind, das vor Safari 16.4 das ganze Skript am Laden hindern würde (R-107).
- Der Live-Test wartet nicht mehr auf eine fehlende Pause-Anzeige. Er scheitert auch, wenn der Bot läuft, aber 4 min lang keinen Fortschritt macht (R-082).
- Der Hook warnt wieder, wenn ein als erledigt eingetragener Branch neue Commits bekommt (R-247).

### Behoben (Review-Tor P2)

- Import-Grenzen lassen sich nicht mehr über `globalThis.chrome`, `window.GM` oder `import()` umgehen. `src/app.ts` ist eingeschlossen (R-032).
- Keine stillen Fehler mehr in `.then`-Fehlerhandlern und bei einem fehlgeschlagenen Start: Er wird als Toast gemeldet (R-199).
- Der Kompatibilitäts-Check für Safari 15 deckt mehr APIs ab, erkennt nur echte Feature-Erkennung an und warnt bei CSS, das nur die Darstellung verschlechtert. Der Build schreibt erst nach der Prüfung (R-107).
- Der Fallback-Schlüssel heißt `pkbot.settings` statt `pkbot.pkbot.settings`. Fehlt GM, wird das einmal vermerkt (R-100, R-102).
- Der SessionStart-Hook zeigt die Kurzform der aktuellen Phase wieder vollständig. Das prüft jetzt ein Test (R-232).

### Bekannt

- Bei langen Bosskämpfen mit gesperrtem SKIP bleibt der Bot hängen (GAME_RECON §12.8). Der Live-Test meldet das jetzt als Fehler. Behoben wird es in Phase 3.

## [0.1.0] – 2026-11-25

Stand aus dem Vorgänger-Branch (D-016): Chrome-Erweiterung (MV3) und Userscript aus einer Codebasis, Overlay, Bildschirmerkennung über IDs, Strategie mit Kampfsimulation über das eigene `runBattle` des Spiels (eigene Seeds aus dem sichtbaren Zustand, D-019, R-248), Actor-Guard gegen Reset und Logout (R-147).
