# Pokelike Bot

> **Für Entwicklung und Claude-Sessions:** Ziel, Regeln und Architektur stehen in [`CLAUDE.md`](CLAUDE.md), die Anforderungen in [`docs/REQUIREMENTS.md`](docs/REQUIREMENTS.md), der Stand in [`docs/PROGRESS.md`](docs/PROGRESS.md) und die Phasen in [`docs/PLAN.md`](docs/PLAN.md).


Spielt [pokelike.xyz](https://pokelike.xyz) selbstständig: Starter, Route, Fänge, Items, Reihenfolge und Neustarts.
Die Kämpfe laufen im Spiel automatisch. Eine Codebasis liefert zwei Ziele:

| Ziel | Datei | Für |
|---|---|---|
| Chrome-Erweiterung (Manifest V3) | `dist/chrome/` (entpackt) und `dist/pokelike-bot-chrome-<version>.zip` | Chrome, Edge, Opera, Brave |
| Userscript | `dist/pokelike-bot.user.js` (+ `.meta.js`) | „Userscripts“ (Safari iOS/iPadOS/macOS), Tampermonkey, Violentmonkey |

> Fan-Projekt, nicht mit Nintendo/Game Freak/The Pokémon Company oder pokelike verbunden. Nutzung auf eigene Verantwortung.

## Bauen

```bash
npm install
npm run build              # beide Ziele
npm run build:chrome       # nur dist/chrome + zip
npm run build:userscript   # nur dist/pokelike-bot.user.js + .meta.js
```

## Installation

### Chrome / Edge / Brave
1. `npm run build:chrome`.
2. `chrome://extensions` öffnen (Edge: `edge://extensions`) und den **Entwicklermodus** einschalten.
3. **Entpackte Erweiterung laden** und den Ordner `dist/chrome` wählen.
4. pokelike.xyz öffnen. Unten links erscheint das Overlay „Pokelike Bot“.

### Opera / Opera GX
1. `npm run build:chrome`.
2. `opera://extensions` öffnen, den **Entwicklermodus** einschalten und **Entpackte Erweiterung laden** → `dist/chrome`.
3. Die Tastenkürzel lassen sich unter `opera://extensions/shortcuts` ändern.

### iPhone / iPad (Safari) mit der App „Userscripts“
1. Die kostenlose App **Userscripts** (Justin Wasack) aus dem App Store installieren.
2. Unter Einstellungen → Safari → Erweiterungen „Userscripts“ einschalten und **für pokelike.xyz erlauben**.
3. Die Datei `dist/pokelike-bot.user.js` in den Userscripts-Ordner legen (z. B. über die Dateien-App/iCloud). Alternativ
   die `.user.js` in Safari öffnen und über das Userscripts-Symbol in der Adressleiste installieren.
4. pokelike.xyz in Safari öffnen. Das Overlay erscheint. Auf dem Handy wird es über die Overlay-Buttons bedient,
   Tastenkürzel gibt es dort nur mit Hardware-Tastatur.

### Tampermonkey / Violentmonkey (Desktop)
Im Dashboard **Neues Skript** wählen, den Inhalt von `dist/pokelike-bot.user.js` einfügen und speichern, oder die Datei
per Drag & Drop in den Browser ziehen.

Das Userscript nutzt nur die GM-Funktionen, die alle drei Manager gemeinsam haben (`GM.getValue`, `GM.setValue`,
`GM.setClipboard`). Details: [`docs/USERSCRIPT_API.md`](docs/USERSCRIPT_API.md). Änderungen je Version: [`CHANGELOG.md`](CHANGELOG.md).

## Bedienung

- **Overlay** (beide Ziele): Start/Pause, Einzelschritt, Status (Bildschirm, letzte Entscheidung mit Begründung,
  Datenquelle, Spielversion, Siege/Niederlagen), Einstellungen, Log (kopierbar). Es ist zusammenklappbar und verschiebbar.
- **Chrome zusätzlich:** Popup (Start/Pause/Schritt/Status), Optionsseite (dieselben Einstellungen), System-Benachrichtigungen
  und Browser-Tastenkürzel über `commands`. Alles wird per Feature-Erkennung genutzt, sonst greifen In-Page-Toasts.
- **Challenges:** Modus „Challenge“, Art (Arena/Täglich/Wöchentlich), Orden-Stufe und **Challenge-Starter**. Das
  Starter-Dropdown im Overlay listet deinen PC (nur gelesen aus dem Spielstand, stärkste zuerst, ★ = Shiny); gewählt
  wird das stärkste Exemplar dieser Art (Shiny/Vitamine/Mega). „Auto“ nimmt das insgesamt stärkste. Auf der
  Chrome-Optionsseite gibt man stattdessen die Dex-Nr. ein. Relikte wählt der Bot per Kampfsimulation.
- **Tastenkürzel auf der Spielseite:** `Alt+Shift+P` Start/Pause · `Alt+Shift+S` Schritt · `Alt+Shift+O` Overlay ein/aus.
- **Spieleinstellungen** (z. B. Kämpfe automatisch überspringen) ändert der Bot **nur nach deiner zweistufigen Bestätigung**
  im Overlay („Einschalten …“ → „Ja, ändern“).
- **Sicherheit:** Der Bot liest den Spielzustand und patcht keine Spielfunktionen. Er schreibt nie selbst in die Schlüssel
  des Spiels (`poke_*`, `pkrl_*`); der Userscript-Fallback nutzt eigene `pkbot.*`-Schlüssel. Die Ausnahmen regelt D-018:
  Spieleinstellungen ändert er nur nach zweistufiger Bestätigung über die Funktion `saveSettings` des Spiels, und für
  Simulationen setzt er Zufalls-Seed und ID-Zähler vorübergehend und stellt beide exakt wieder her (D-019). Unbekannte Bildschirme oder Dialoge pausieren ihn mit Hinweis. Ändert sich die Spielversion
  (bekannt: v3.8), zeigt er eine Warnung und pausiert schon beim ersten Fehlschlag.

## Architektur

```
src/
  core/            gemeinsam, plattformunabhängig
    bridge/        Main-World-Bridge (liest `state`, `TYPE_CHART`, `PATCH_NOTES`, `getSettings`) + Client (CustomEvent/JSON)
    state/         StateReader (Bridge + DOM), DOM-Parser (sprachunabhängig)
    screens/       ScreenDetector (IDs/Klassen, Overlays; unbekannt ⇒ Pause)
    strategy/      DecisionEngine + reine Entscheidungsfunktionen (docs/STRATEGY.md)
    actions/       Actor: menschliche Klicks/Tasten mit Zufallsversatz; Verifikation + Backoff im BotController
    data/          Typentabelle Gen VI (Fallback; zur Laufzeit gilt TYPE_CHART des Spiels), Boss-Typ-Hinweise
    log/           Ringpuffer-Log
    bot.ts         Schleife lesen → erkennen → entscheiden → handeln → prüfen
  ui/              Overlay (Shadow DOM), Einstellungsformular, Toasts – für beide Ziele identisch
  platform/
    chrome/        Content-Script, MAIN-World-Bridge, Service Worker, Popup, Optionen
    userscript/    GM-Adapter (nur GM.*-Schnittmenge, Fallback localStorage pkbot.*), Bridge per <script>-Element
```

Details zum Spiel (Bildschirme, Selektoren, Datenquellen) stehen in [docs/GAME_RECON.md](docs/GAME_RECON.md).

## Tests

```bash
npm test          # Vitest: Detector, Parser, Engine, Strategie – gegen echte DOM-Snapshots (tests/fixtures/dom)
npm run e2e       # Playwright: Chrome-Extension (entpackt), Userscript Desktop 1440×900 und WebKit/iPhone (390×844, 390×664, SE)
npm run e2e:live  # echter Lauf gegen pokelike.xyz mit geladener Extension (LIVE_MINUTES, optional PKBOT_SAVE)
npm run lint && npm run typecheck
npm run check:userscript  # Bundle- und Metadaten-Check des gebauten Userscripts (läuft auch im Build)
npm run check:docs        # Konsistenz der Gedächtnis-Dateien (läuft auch in npm test)
```

`PKBOT_SAVE` darf auf einen localStorage-Export **ohne** Cloud-Token zeigen. Er wird nur in ein Wegwerf-Profil geladen.
Solche Dateien gehören nie ins Repo (`.gitignore`). WebKit für die E2E-Tests: `npx playwright install webkit && npx playwright install-deps webkit`.

## Bekannte Grenzen

- Live getestet ist Story **Classic** (Kanto). Nuzlocke nutzt denselben Ablauf, ist live aber noch ungetestet. Automatisiert ist der Großteil der Kartenereignisse. Shop, Tower-Buffs und Pokésort pausieren
  bewusst, bis sie live erfasst und umgesetzt sind.
- Der Battle Tower ist experimentell (Region wählen, danach pausiert der Bot bei neuen Screens).
- Im DOM-Fallback (ohne Bridge) sind die Entscheidungen schwächer (keine Kartendaten, keine Spiel-Attacken).
