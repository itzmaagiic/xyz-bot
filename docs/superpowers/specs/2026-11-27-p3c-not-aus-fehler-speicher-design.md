# P3c – Not-Aus, unerwartete Fehler, Speicherprobleme: Design

Stand 2026-11-27 · Phase 3, drittes Inkrement · Freigabe nach CLAUDE.md (D-006) durch eigenes Review und D-039. Grundlage:
- R-011, R-200, R-259
- die Lint-Lücken aus D-036
- die Bestandsaufnahme P1 (Pause greift nur zwischen Ticks)
- Vorbefunde des UI-Reviews P2 (Fehlerzustand nicht von Hinweisen unterscheidbar)

## Absicht
Wer dem Bot zusieht, muss ihn **sofort** anhalten können: „Pause“ heißt, dass ab jetzt kein Klick und kein Tastendruck mehr passiert, auch wenn der Bot gerade simuliert, zielt oder Tauschschritte ausführt. Heute greift die Pause erst am Ende eines Ticks. Nach einer langen Simulation klickt der Bot trotz Pause noch einmal (P1-Befund).

Zwei weitere Arten von Problemen gehen heute unter:
- **Unerwartete Fehler** außerhalb der Bot-Schleife. Das sind Fehler in Event-Handlern und Promises, die ein Lint nicht findet (D-036). Sie landen nur in der Konsole.
- **Speicher, der nicht speichert.** In Chrome kommt nach einem Update der Erweiterung „Extension context invalidated“. Auf dem iPhone verliert das Userscript im privaten Surfen oder ohne GM seine Einstellungen beim Neuladen. Heute merkt das niemand.

## Ziele (R-IDs)
- **R-011:**
  - Pause wirkt sofort. Nach `pause()` feuert der Bot kein weiteres Spiel-Event mehr: kein Klick, kein Tastendruck, kein `openBagItem`.
  - Das gilt auch, wenn die Pause während `refresh`, `attachSim`, der Mikro-Pause im Actor, eines Tauschschritts oder des Backoffs kommt.
  - Eine abgebrochene Aktion zählt weder als Fehlschlag noch als Wirkung. Sie steht im Run-Log mit `outcome: 'aborted'`.
- **R-200:**
  - Ein globaler Handler für `error` und `unhandledrejection` in der Welt des Bots (Content-Script bzw. Userscript).
  - Er vermerkt den Fehler (`noteError`), schreibt eine Zeile `error` ins Bot-Log (rot im Overlay) und zeigt beim ersten Auftreten eines Fehlers einen Toast: „Unerwarteter Fehler im Bot – Details im Log“.
  - Fehler des Spiels selbst (Skripte von `pokelike.xyz`) ignoriert er.
  - Der Bot pausiert dabei nicht. Das tut er nur, wenn die Schleife selbst abstürzt (`crashed`, wie bisher).
  - Ein Test deckt eine Rejection aus einem Ternär-Handler an `addEventListener` ab: als Unit-Test und im echten Browser (E2E, isolierte Welt des Userscripts in Chromium).
- **R-259:**
  - Scheitert das Speichern, zeigt das Overlay einen dauerhaften Hinweis `#pk-storage` in Alltagssprache mit dem nächsten Schritt. Er verschwindet, sobald wieder gespeichert werden kann. Das gilt für Einstellungen und Statistik.
  - **Chrome**, Meldung „Extension context invalidated“: „Die Verbindung zur Erweiterung ist abgerissen (z. B. nach einem Update). Bitte die Seite neu laden – bis dahin wird nichts gespeichert.“
  - **Userscript, nur noch Arbeitsspeicher** (GM und localStorage scheitern, z. B. im privaten Surfen): „Einstellungen können nicht dauerhaft gespeichert werden (privates Surfen?). Sie gelten nur bis zum Neuladen.“
  - **Sonst:** „Einstellungen konnten nicht gespeichert werden: <kurzer Grund>. Sie gelten bis zum Neuladen.“
  - Die Chrome-Optionsseite zeigt denselben Text an ihrem Formular.

## Nicht-Ziele
- **R-109** (Neuladen: Laufstatus und Run-Logs übernehmen), **R-108** und **R-229** (doppelte Ausführung, Tab-Sperre), **R-213** (Eingriff des Nutzers), **R-214** (fremder Run): eigenes Inkrement **P3d**. Begründung: Persistente Run-Logs brauchen ein Speicherkonzept, denn der localStorage-Fallback teilt sich das Kontingent der Spielseite. R-214 braucht dieselbe Markierung „Run des Bots“ wie R-109.
- **Handler in der MAIN-Welt:** Die Bridge fängt ihre Fehler selbst (`handle`, `noteRejection`). Ein globaler Handler dort sähe vor allem Fehler des Spiels, und im Userscript wäre das Inline-Skript der Bridge nicht vom Spiel zu unterscheiden.
- Laufende Simulationen in der Seite abbrechen. Ihr Ergebnis wird nach einer Pause verworfen.
- Neue Gestaltung des Overlays (P5). Der Hinweis nutzt die bestehende Klasse `warn bad`.

## Anti-Ziele
- Eine Pause, die noch einen „letzten“ Klick durchlässt.
- Ein Fehler-Handler, der Fehler des Spiels als Bot-Fehler meldet und damit den Nutzer beunruhigt und den Strategy-Review verfälscht.
- Ein Hinweis, der nur kurz als Toast aufblitzt, obwohl der Zustand anhält (Einstellungen gehen verloren).
- Technische Meldungen ohne nächsten Schritt.

## Ansätze
**Not-Aus:**
1. **Lebendigkeitsmarke (gewählt):**
   - `pause()` erhöht eine Epoche.
   - Jeder Tick merkt sich seine Epoche und prüft `live()` an jeder Grenze, nach der eine Aktion folgen könnte: nach `refresh`, nach `attachSim`, vor jedem Klick, jedem Tastendruck, jedem Bridge-Befehl mit Wirkung und im Actor nach jeder Mikro-Pause.
   - Klein, lückenlos prüfbar, kein neues Browser-API.
2. **AbortController/AbortSignal durch alle Schichten:** Schläfer würden sofort aufgeweckt, aber das bringt keinen praktischen Unterschied (nach dem Schlaf folgt ohnehin die Prüfung). Der Eingriff ist viel größer (Actor, sleep, Bridge-Client). Verworfen.
3. **Nur am Tick-Anfang prüfen (Ist-Zustand):** Verworfen, das ist der Befund.

**Speicherprobleme:**
- (a) **`set()` liefert `'volatile'`, wenn nur der Arbeitsspeicher bleibt; Fehler werfen wie bisher (gewählt).** Der Bot fasst beides in `view.storageProblem` zusammen.
- (b) Ein eigener Status-Kanal der Plattform. Mehr Schnittstelle bei gleichem Nutzen. Verworfen.

## Design
**Not-Aus (`src/core/bot.ts`, `src/core/actions/actor.ts`):**
- `BotController`:
  - `private epoch = 0`. `pause()` erhöht sie.
  - `tick()` setzt `const live = this.liveness()` (`() => this.epoch === ep`).
  - Nach `refresh` und nach `attachSim`: `if (!live()) return { kind: 'wait', ms: 0, why: 'paused' }`.
  - `doClick`, `doSwap`, `doReorder` und `doOpenBag` bekommen `live` und prüfen vor jeder Wirkung.
  - `failed()` macht nach einer Pause keinen Backoff-Schlaf mehr.
- `Actor.click(el, live?)` und `Actor.pressKey(doc, code, key, mods, live?)`:
  - Sie prüfen `live()` vor dem ersten Event und nach jeder Mikro-Pause.
  - Abbruch heißt: kein weiteres Event. Rückgabe `false` = nicht ausgeführt, `true` = ausgeführt.
- **Run-Log:** `setOutcome(line, 'aborted')`. Eine abgebrochene Aktion zählt weder als `noEffect` noch als Klick-Fehlschlag (`failKey` bleibt).

**Globale Fehler (`src/core/log/global-errors.ts`, verdrahtet in `src/app.ts`):**
- `installGlobalErrorHandlers(win, onUnexpected)`:
  - `error`: Ist `ErrorEvent.filename` eine URL von `win.location.origin`, gilt der Fehler als Fehler des Spiels und wird ignoriert. Sonst ruft er `onUnexpected('global:error', e.error ?? e.message)`.
  - `unhandledrejection`: Enthält der Stack des Grundes eine URL von `win.location.origin`, gilt er als Fehler des Spiels. Sonst ruft er `onUnexpected('global:unhandledrejection', e.reason)`.
  - Doppelte Installation in derselben Welt wird verhindert.
- `BotController.reportUnexpected(where, err)`:
  - `noteError(where, err)`.
  - `log.error('unexpected: <msg>')`.
  - Beim ersten Auftreten je Text ein Toast über einen Callback, den `app.ts` setzt.

**Speicherprobleme (`src/platform/types.ts`, `src/platform/userscript/storage.ts`, `src/core/bot.ts`, `src/ui/overlay.ts`, `src/platform/chrome/options.ts`):**
- `PlatformStorage.set(): Promise<void | 'volatile'>`. Der Userscript-Speicher liefert `'volatile'`, wenn er nur in `mem` schreiben konnte.
- `storageProblemText(err | 'volatile'): string` (`src/ui/storage-problem.ts`) für die drei Texte oben. Die Chrome-Erkennung läuft über `/Extension context invalidated/i`.
- `BotController`:
  - Ein `persist(key, value)` für Einstellungen und Statistik.
  - Fehler oder `'volatile'` setzen `view.storageProblem`, ein erfolgreicher Schreibvorgang löscht es.
  - `updateSettings` wirft nicht mehr: Die Einstellung gilt im Speicher weiter, und das Problem wird gezeigt.
- **Overlay:** `#pk-storage` als `div.warn.bad` mit dem Text, solange `view.storageProblem` gesetzt ist.
- **Optionsseite:** `chrome.storage.local.set(...)` bekommt `.catch(e => status.textContent = storageProblemText(e))`. Das Statusfeld `#pk-options-status` sitzt im Formular.

## Tests (Zusammenfassung)
- **Unit, Not-Aus:**
  - Pause während `attachSim` → kein Klick.
  - Pause in der Mikro-Pause des Actors → kein `pointerdown`, `click(...)` liefert `false`.
  - Pause zwischen zwei Tauschschritten → kein zweiter Tastendruck.
  - Eine abgebrochene Aktion ist kein Fehlschlag und hat `outcome` `aborted`.
- **Unit, globale Fehler:**
  - Eine Rejection aus einem Ternär-Handler an `addEventListener` (simuliertes Event) wird gemeldet.
  - Ein `ErrorEvent` mit `filename` von `pokelike.xyz` wird ignoriert.
  - Doppelte Installation meldet nur einmal.
  - Der Toast erscheint nur beim ersten Auftreten.
- **E2E (Chromium, isolierte Userscript-Welt):** Ein echter Button-Klick mit Ternär-Async-Handler, der wirft, erzeugt die Zeile „unexpected: …“ im Overlay-Log.
- **Unit, Speicher:**
  - Werfender Chrome-Speicher („Extension context invalidated“) → Hinweistext „Seite neu laden“.
  - Userscript ohne GM und mit werfendem localStorage → `'volatile'` und der Hinweis zum privaten Surfen.
  - Ein späteres erfolgreiches Speichern entfernt den Hinweis.
  - Die Texte von `storageProblemText`.
- **E2E (Userscript, GM wirft und localStorage wirft):** Eine Einstellung ändern → `#pk-storage` sichtbar.

## Dem Umsetzer überlassen
Die genaue Formulierung der Log-Zeilen, die Namen der Testfälle und wo die Prüfung `live()` im Actor genau sitzt, solange vor jedem Event geprüft wird.
