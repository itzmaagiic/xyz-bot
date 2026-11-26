# P3b – Run-Logs, belastbares Live-Urteil, Fehler aus der MAIN-Welt: Design

Stand 2026-11-26 · Phase 3, zweites Inkrement · Freigabe nach CLAUDE.md (D-006) durch eigenes Review und D-038 · Grundlage: D-005, D-012, R-006, R-007, R-009, R-091, R-253, R-254, Vorbefunde des strategy-reviewers (`docs/superpowers/audits/2026-11-26-p2-gate-ui-strategy.md`, P0 „keine prüfbaren Run-Logs“, P1 „Stillstandserkennung mit blinden Flecken“, P1 „sachliche Fehler zählen als gewollte Pause“).

## Absicht
Der Bot verliert noch jeden Run. Warum, kann heute niemand belastbar sagen:
- Das Overlay-Log hat nur 500 Zeilen ohne Struktur.
- Die Entscheidungen enthalten weder den Zustand noch die Alternativen.
- Eine Zusammenfassung je Run gibt es nicht.

P4 (Strategie) braucht aber genau das. Der strategy-reviewer prüft „anhand der Logs echter Runs“ unter `runs/`, und A/B-Vergleiche brauchen Ergebnis, Fortschritt und Dauer je Run.

Zugleich soll das Urteil des Live-Tests so belastbar werden, dass ein grüner Lauf wirklich „ohne Hänger“ heißt:
- typisierte Pausen
- Fortschritt auch in der Top-4-Kette
- Hänger auch kurz vor Laufende
- Fehler aus der MAIN-Welt (Simulator, Bridge) sichtbar statt nur in der Konsole der Seite

## Ziele (R-IDs)
- **R-006:** Jede ausgeführte Entscheidung wird strukturiert nach D-005 protokolliert: Zustand (kompakt), Optionen, Bewertungen, Wahl, Begründung, Konfidenz, Profil, Modus und Ergebnis der Aktion. Export als Datei aus dem Overlay.
- **R-009:** Zu jedem Run gibt es eine Zusammenfassung:
  - Ergebnis
  - Fortschritt (Orden, Karte, `eliteIndex`, Level)
  - Dauer, Spielversion, Modus, Profil
  - Todesursache bzw. Abbruchgrund
  - Zählwerte und die Verweildauer je Bildschirm, also Kampfdauern als Grundlage für R-254
- **R-007:** Ein Skript übernimmt einen Export nach `runs/<YYYY-MM-DD>-<run-id>/` (`decisions.jsonl`, `summary.json`), nur wenn die Prüfung auf Geheimnisse nichts findet (R-148, R-210). Ein Unit-Test prüft alles, was unter `runs/` eingecheckt ist. Der Live-Test exportiert seine Runs auf Wunsch direkt dorthin.
- **R-091:** Ringpuffer mit Test, für das Bot-Log und das Run-Log. Ältestes fällt heraus, das Limit hält.
- **R-253:** In der MAIN-Welt vermerkte Fehler kommen über den Bridge-Befehl `errors` ins Bot-Log (gedämpft, `debug`, mit ihrem eigenen Zeitstempel) und in die Run-Zusammenfassung.
- **R-254:**
  - Pausen tragen eine Art: `user`, `finished`, `config`, `unsupported` (mit Screen-ID), `inconsistent`, `failing`, `internal`, `blocked`, `stalled`.
  - Fehler sind `inconsistent`, `failing`, `internal`, `blocked` und `stalled`. `unsupported` lässt den Live-Test ebenfalls scheitern, aber mit eigener Meldung, damit es zur Aufklärung R-224 führt statt zur Fehlersuche.
  - Fortschritt zählt beim Wechsel von Knoten, Karte, Orden, `eliteIndex` oder Team-Signatur, außerdem beim Bildschirmwechsel, aber nur, wenn die Kombination aus Bildschirm und Fortschritt seit dem letzten echten Fortschritt neu ist (Schutz vor Ping-Pong-Schleifen).
  - Stillstands-Budget je Bildschirm, aus den P3a-Messwerten.
  - Nachlauf am Ende: Ist die Zeit um, beobachtet der Test weiter, bis Fortschritt kommt oder das Budget des aktuellen Bildschirms abläuft.

## Nicht-Ziele
- **Optionen mit Score für *jede* Entscheidung (R-116, P4).** P3b liefert das Format und füllt es für die vier wichtigsten Entscheidungen: Karte (Route), Fang, Item und Starter. Alle anderen tragen `options: []`. Die Zusammenfassung nennt die Abdeckung.
- **Run-Logs über ein Neuladen der Seite hinweg (Persistenz).** Der Ringpuffer liegt im Speicher. Lädt die Seite neu, beginnt ein neuer Run-Eintrag. Kandidat für ein späteres Inkrement mit R-109.
- **Laufzeit-Handler `unhandledrejection` und `error` (R-200), Speicherfehler (R-259):** eigenes Inkrement.
- **Neue Gestaltung des Overlays (P5).** Der Export-Knopf folgt dem Stil von „Log kopieren“.

## Anti-Ziele
- Run-Logs, die Tokens, Benutzernamen oder andere Personendaten enthalten können. Der Recorder liest nie den localStorage, und jedes Schreiben nach `runs/` geht durch dieselbe Geheimnis-Prüfung.
- Ein Live-Urteil, das an übersetzbaren Texten hängt. Die Art der Pause kommt als Attribut, nicht über den Text, sonst bricht das mit R-174 (Texte in P5).
- Ein Logging, das die Schleife bremst oder Wartezyklen protokolliert. `wait` wird nicht als Entscheidung geloggt, nur als Verweildauer gezählt.

## Ansätze
1. **Run-Logs aus dem vorhandenen Logger ableiten** (die `decision`-Einträge parsen). Klein, aber dem Logger fehlen Zustand und Optionen. Der 500er-Ring mit Debug-Zeilen verdrängt Entscheidungen. Verworfen.
2. **Eigener `RunRecorder` in `core/log` (gewählt):**
   - Der BotController füttert ihn mit Entscheidung, Zustand und Ergebnis.
   - Die Entscheidungen tragen ein optionales `trace` (Optionen, Scores, Konfidenz).
   - Der Export läuft als Datei-Download aus dem Overlay.
   - Ein Node-Skript schreibt nach `runs/`, nur nach der Geheimnis-Prüfung.
   - Funktioniert für echte Nutzer-Runs genauso wie im Live-Test.
3. **Aufzeichnung von außen im Live-Test** (Playwright liest alle 2 s `state`). Gibt es nur in Tests, nicht bei echten Nutzer-Runs. Optionen und Begründungen fehlen, und das 2-s-Raster übersieht kurze Bildschirme. Verworfen.

Für die Pausen-Art:
- **(a) Präfixe im Text** wie bisher bei `errorPause`. Bricht, sobald die Texte übersetzt werden.
- **(b) Strukturiert (gewählt):** `BotView.pauseKind`, im Overlay als `data-kind` an `#pk-pause`. `isErrorPause` bleibt für Altbestand und Tests, arbeitet aber auf der Art.

## Design

### Entscheidungs-Trace (`src/core/types.ts`, Strategie)
- `Decision` bekommt optional `trace?: { options: DecisionOption[]; confidence?: number | null }`.
- `DecisionOption = { id: string; label: string; score: number | null; factors?: Record<string, number> }`.
- Gefüllt wird es von:
  - `chooseCatch`, `chooseItem` und `chooseStarter`, die schon Scores rechnen, sie aber verwerfen. Sie geben die Liste jetzt mit zurück, ohne andere Wahl.
  - `decideMap` mit Sim: jede bewertete Route mit `boss`, `survive` und `next` als Faktoren. Ohne Sim: `chooseRoute` mit dem Wert je Route.
- Die Konfidenz ist die simulierte Erfolgsquote, wo es eine gibt, sonst `null`.
- **Keine Verhaltensänderung:** Bestehende Engine-Tests bleiben unverändert grün, neue Tests prüfen den Trace.

### `RunRecorder` (`src/core/log/run-log.ts`, rein, plattformfrei)
- **`record(d, st, ctx)` ergibt eine D-005-Zeile:**
  - Felder: `ts`, `run_id`, `step`, `game_version`, `screen`, `state`, `options`, `scores`, `chosen`, `reason`, `confidence`, `profile`, `mode`, `outcome`.
  - `outcome` ist anfangs `null`. Die Wirkungsprüfung setzt es auf `ok` oder `no-effect`, die Stopp-Zeile auf `win` oder `loss`.
  - `state` ist kompakt: Team mit Name, Level, KP, Typen und Item; dazu Items, Beutel-IDs, Orden, Karte, Knoten samt Typ, `eliteIndex`, Generation, Nuzlocke und der nächste Boss aus der Sim, falls bekannt.
- **Run-Grenzen:**
  - Ein Run öffnet sich mit der ersten aufgezeichneten Entscheidung nach Bot-Start oder nach dem Ende des vorigen Runs. So gehört die Starterwahl zum Run.
  - Er schließt mit `stop` (Sieg oder Niederlage).
  - Pausen schließen nicht. Sie landen als `pauses[]` mit Art und Text in der Zusammenfassung.
- **`observe(st, now)` je Tick:**
  - Verweildauer je Bildschirm: `{ n, totalMs, maxMs }`.
  - Höchster Fortschritt: Orden, Karte, `eliteIndex`, Höchstlevel.
  - Letzter Kampfkontext: Knotentyp, Bossname und Team-KP.
- **`summary(run)`** (R-009):
  - `run_id`, `started`, `ended`, `durationMs`, `result` (`win`, `loss`, `open` oder `aborted`; abgebrochen heißt mit Fehler-Pause und ohne Stopp)
  - `progress`, `game_version`, `mode` (Modus, Region bzw. Variante), `profile` (Bot-Einstellungen, die die Strategie betreffen, dazu `FLAGS`)
  - `cause`: bei einer Niederlage der letzte Kampf (Knotentyp, Karte, Boss, Team am Ende); bei einem Abbruch die letzte Pause mit Art
  - `counts`: Entscheidungen, Klicks, `no-effect`, Watchdog-Neueinlesungen
  - `screenTimes`, `errors` (Bot-Welt und MAIN-Welt, je mit `world`), `optionCoverage` (Anteil der Entscheidungen mit Optionen)
- **Grenzen (R-091):** höchstens 10 Runs im Speicher (FIFO) und höchstens 3000 Zeilen je Run. Danach fällt die älteste Zeile heraus, die Zusammenfassung zählt `dropped`.
- **`exportBundle()`:** `{ format: 'pkbot-runs/1', exported, bot_version, runs: [{ summary, decisions }] }`.
- **Die Zeit ist injizierbar** (`now`), damit das testbar ist.

### BotController (`src/core/bot.ts`)
- `readonly runs = new RunRecorder(...)`.
- An den vier Stellen, die heute `this.log.log('decision', …)` schreiben, plus `stop` und `pause`, ruft er `decided(d, st, extra)`. Das schreibt die Log-Zeile wie bisher und zeichnet auf. `doClick` setzt danach das Ergebnis.
- `tick()` ruft `runs.observe(st)`. `wait` wird nicht aufgezeichnet.
- Watchdog-`reread` zählt in `counts`.
- `pause(kind, text)`:
  - `view.pauseKind` neben `view.pauseReason`.
  - `errorPause()` bleibt als Textbauer erhalten, die Art geht getrennt mit.
  - Pausen aus der Engine bekommen ihre Art über ein neues Feld `cause` an der `pause`-Entscheidung:
    - `config`: Region gesperrt, Challenge nicht angeboten, Badge-Level gesperrt.
    - `unsupported`: Bildschirm noch nicht automatisiert, unbekannter Dialog, unbekannter Bildschirm (mit `screenId`).
    - `inconsistent`: Kartenknoten passen nicht zu den Spieldaten, Relikt-Dialog ohne neues Relikt, Stage ohne bekannten Knopf, Challenge-Bildschirm ohne Play-Knopf.

### Fehler aus der MAIN-Welt (R-253)
- **Bridge:**
  - Neuer Befehl `errors` mit `{ since }`. Er liefert `{ seq, errors: NotedError[] }` aus dem Puffer der MAIN-Welt.
  - `snapshot` liefert zusätzlich `errSeq`. Das ist die Zahl der bisher vermerkten verschiedenen Fehler, ein billiger Zähler.
- **StateReader:** Steigt `errSeq`, holt er die neuen Fehler mit `errors` und gibt sie an einen Callback.
- **Bot:**
  - Er loggt jeden Fehler gedämpft als `debug` mit dem Zeitstempel des Fehlers, als `handled (page): where – msg`.
  - Er zeichnet ihn im aktuellen Run unter `errors` mit `world: 'main'` auf.
  - `Logger.log` nimmt dafür optional einen Zeitstempel. Das behebt nebenbei den P2-Vorbefund „Zeitstempel vorgemerkter Fehler = Bot-Start“.
- **Fallback-Ketten:** Die bestehenden Warnungen beim Totalausfall („simulation unavailable – using heuristics“, DOM-Fallback des Readers) bleiben `warn`. Einzelfehler innerhalb einer Kette bleiben `debug`.

### Export und Übernahme nach `runs/` (R-006, R-007)
- **Overlay:**
  - Knopf „Runs exportieren“ (`#pk-export-runs`) neben „Log kopieren“.
  - Er erzeugt `pkbot-runs-<YYYYMMDD-HHMMSS>.json` als Download (Blob und `<a download>`, nur DOM, keine neue Berechtigung).
  - Klappt das nicht, kopiert er das JSON über `platform.copyText` (Fallback für iOS).
  - Toast mit Ergebnis.
- **`scripts/runs-lib.mjs`:**
  - `scanSecrets(text)` findet E-Mail-Adressen, UUIDs, JWT-artige Tokens, Hex-Folgen ab 32 Zeichen und die Schlüssel `poke_*` und `pkrl_*`, `token`, `username`, `owner`.
  - `writeRunDirs(bundle, root)` schreibt `runs/<YYYY-MM-DD>-<run-id>/decisions.jsonl` und `summary.json`, nur wenn der Scan nichts findet. Bei einem Treffer bricht es ab und nennt die Fundstelle, ohne den Wert auszugeben.
- **`scripts/import-runs.mjs <export.json>`** (`npm run runs:import`).
- **Tests:**
  - `tests/unit/runs-lib.test.ts`: Scan positiv und negativ, Schreiben, Abbruch.
  - `tests/unit/runs-clean.test.ts`: Alles unter `runs/` besteht den Scan, und jede `decisions.jsonl`-Zeile hat die D-005-Felder.
- **Live-Test:**
  - Klickt am Ende „Runs exportieren“, fängt den Download ab und legt ihn unter `PKBOT_OUT` ab.
  - Mit `LIVE_SAVE_RUNS=1` schreibt er zusätzlich über `writeRunDirs` nach `runs/`.

### Live-Urteil (R-254, `tests/e2e/live-progress.ts`, rein)
- **`ProgressTracker`:**
  - `observe({ screen, node, map, badges, eliteIndex, teamSig }, now)` gibt `progress | none` zurück.
  - Die Kombination aus Bildschirm und Fortschritt zählt nur, wenn sie seit dem letzten echten Fortschritt noch nicht gesehen wurde.
  - `stalled(now)` vergleicht die Zeit auf dem aktuellen Bildschirm ohne Fortschritt mit `SCREEN_BUDGET_MS[screen]`, sonst gilt der Standard.
- **Budgets aus den P3a-Messwerten** (Kampf längstens 33,4 s, Simulationen auf der Karte zusammen bis etwa 135 s Timeout):

  | Bildschirm | Budget |
  |---|---|
  | `battle-screen` | 120 s |
  | `map-screen` | 180 s |
  | Standard | 90 s |
  | gesamt ohne Fortschritt | 4 min (wie bisher) |

  Die Run-Logs liefern ab jetzt `screenTimes`, um sie nachzuschärfen.
- **`liveVerdict`** bekommt `pauseKind` statt des Texts:
  - Fehlerarten scheitern mit „error pause“.
  - `unsupported` scheitert mit „unsupported screen <id> (R-224)“.
  - Stillstand je Bildschirm scheitert mit „stalled on <screen> for … s (budget …)“.
- **Nachlauf:** Nach `LIVE_MINUTES` beobachtet der Test weiter, bis Fortschritt eintritt oder das Budget des aktuellen Bildschirms abgelaufen ist, höchstens 4 min.
- **`readState`** liest zusätzlich `eliteIndex` und eine Team-Signatur (Arten und Level, keine Namen nötig).

## Tests (Zusammenfassung)
- Unit:
  - Trace der vier Entscheidungen.
  - `RunRecorder`: Zeile nach D-005, Run-Grenzen, Pausen, Ergebnis, Todesursache, Abbruch, Verweildauern, Ring-Limits, Export.
  - Bot-Verdrahtung: Klick mit `ok` bzw. `no-effect`, Stopp schließt den Run, `wait` wird nicht aufgezeichnet, die Pausen-Art landet in `view`.
  - Bridge `errors` und `errSeq`, Reader-Callback, Logger-Zeitstempel.
  - Logger-Ring (R-091).
  - `runs-lib` und `runs-clean`.
  - `ProgressTracker` und `liveVerdict`: Ping-Pong, Top-4-Kette, Budget je Bildschirm, Nachlauf.
- E2E (Fixtures):
  - „Runs exportieren“ lädt eine Datei mit `format: 'pkbot-runs/1'`, in Chrome und im Userscript für den Desktop.
  - `#pk-pause[data-kind]` ist gesetzt.
- Live: ein Lauf mit `LIVE_SAVE_RUNS=1`. Die Runs landen unter `runs/`, die Zusammenfassung zeigt Ergebnis, Fortschritt und Todesursache, und das Urteil ist leer oder nennt einen echten Fund.

## Dem Umsetzer überlassen
- Die genauen Feldnamen innerhalb von `state` und `progress`, solange D-005 eingehalten ist.
- Die Form der `run_id` (Zeitstempel und Zufall), die Texte der Toasts und die Namen der Testfälle.
