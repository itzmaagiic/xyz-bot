# P3a – Kämpfe ohne Hänger: Umsetzungsplan

> **Für ausführende Agenten:** PFLICHT-SKILL: superpowers:executing-plans (inline, D-037) bzw. superpowers:subagent-driven-development. Schritte als Checkboxen (`- [ ]`).

**Ziel:** Der Bot klickt nur bedienbare Ziele. Ein nach dem Klick gesperrter Knopf gilt als Wirkung, laufende Kämpfe werden abgewartet, und echte Hänger erkennt ein Watchdog. Damit verschwindet der SKIP-Hänger am Bosskampf (GAME_RECON §12.8).

**Architektur:** Reine, testbare Bausteine:
- `isActionable` und die Kampfsignatur im Detector
- `clickPrecheck` und `waitForEffect` (MutationObserver) in `core/actions/effect.ts`
- die Zustandsmaschine `Watchdog` in `core/watchdog.ts`

Der Bot verdrahtet sie nur.

**Tech-Stack:** TypeScript, Vitest (happy-dom), Playwright (Live).

**Spec:** `docs/superpowers/specs/2026-11-26-p3a-kaempfe-ohne-haenger-design.md` · D-037

## Globale Vorgaben
- **Bedienbar heißt:** `isShown(el)` und nicht `el.matches(':disabled')` und nicht `aria-disabled="true"` und berechnetes `pointer-events` ≠ `none`.
- **Kampfsignatur:** `skip` (bedienbar) bzw. `skip-off` (sichtbar, gesperrt) bzw. leer, dazu `cont`, wenn WEITER bedienbar ist, dazu `hp:<hash>` über die `#battle-screen .hp-text`-Texte.
- **Watchdog:** Einstellung `watchdogSec`, Standard **60**, Bereich **15–600**. Nach `watchdogSec` ohne Signaturänderung wird erneut eingelesen, nach weiteren `watchdogSec / 2` folgt die Pause `errorPause('stalled', …)` mit dem Präfix `stalled`.
- Nie neu laden (R-241), nie gesperrte Ziele klicken (D-037).
- Nach jedem Task: `npm test`, `npm run typecheck` und `npx eslint .` grün, committen, auf den Branch und nach `main` pushen, PROGRESS aktualisieren.

## Review-Fokus
1. **Ein Knopf, der dauerhaft gesperrt bleibt** (Spiel hängt): Kein Klick-Spam. Der Watchdog pausiert nach `watchdogSec × 1,5` mit `stalled`. Test in T4.
2. **Ein Bosskampf von 16,7 s mit gesperrtem SKIP:** Keine Pause und kein Fehlschlag, am Ende wird WEITER geklickt. Replay-Test in T5.
3. **Ein Klick, der den Knopf entfernt statt ihn zu sperren** (normaler Fall, etwa Item gewählt): weiterhin Wirkung. Test in T3.
4. **Nutzer pausiert, während der Watchdog zählt:** Nach Start bzw. Pause setzt sich der Watchdog zurück, es gibt keine sofortige Pause nach dem Fortsetzen. Test in T4.
5. **Element aus `pointer-events:none`-Elternteil:** Das Element ist nicht bedienbar, wenn es selbst `pointer-events:none` berechnet. Test in T1.

---

### Task 1: Detector – `isActionable` und Kampfsignatur (R-087, R-010)

**Dateien:** Ändern `src/core/screens/detector.ts`. Test `tests/unit/detector.test.ts`, ergänzen.

**Schnittstellen:**
- Liefert `isActionable(el: Element | null | undefined): el is HTMLElement`, exportiert.
- Die Kampfsignatur enthält `skip` | `skip-off` | '' + `cont`? + `hp:<hash>`.

- [ ] **Schritt 1: Failing Tests:**
  - `isActionable is false for a disabled button, aria-disabled="true", pointer-events:none and display:none; true for a normal button`
  - `battle signature: skip when SKIP is enabled, skip-off when disabled (fixture battle-gym, attribute disabled set)`
  - `battle signature changes when an .hp-text changes`
- [ ] **Schritt 2:** `npx vitest run tests/unit/detector.test.ts` ergibt FAIL.
- [ ] **Schritt 3: Umsetzen.**
  - `isActionable` wie in den Globalen Vorgaben.
  - `extraSignature('battle')` nach den Globalen Vorgaben. Hash: kurzer FNV-1a über `texts.join('|')`, zur Basis 36.
- [ ] **Schritt 4:** Tests grün, die ganze Suite grün (bestehende Signatur-Tests bei Bedarf anpassen, Wunsch-Verhalten beibehalten).
- [ ] **Schritt 5:** Commit „P3a T1: isActionable, Kampfsignatur mit SKIP-Zustand und KP-Fortschritt (R-087, R-010)“.

### Task 2: Engine – gesperrter SKIP heißt warten (R-010)

**Dateien:** Ändern `src/core/strategy/engine.ts` (`case 'battle'`). Test `tests/unit/engine.test.ts`, ergänzen.

**Schnittstellen:** Verwendet `isActionable` aus T1.

- [ ] **Schritt 1: Failing Tests (Fixture `battle-gym`):**
  - SKIP gesperrt, WEITER versteckt ergibt `{kind:'wait'}` mit `why` passend zu `/battle running/`.
  - WEITER sichtbar und bedienbar ergibt Klick auf `#btn-continue-battle`.
  - SKIP bedienbar ergibt Klick auf `#btn-auto-battle` (Bestandsfall).
- [ ] **Schritt 2:** FAIL. **Schritt 3:** Im Kampfzweig `isActionable` statt `shown` für beide Knöpfe nutzen, sonst `wait`, 700 ms, „battle running (skip pressed)“, wenn SKIP sichtbar und gesperrt ist.
- [ ] **Schritt 4:** grün. **Schritt 5:** Commit „P3a T2: Engine wartet bei gesperrtem SKIP (R-010)“.

### Task 3: Klick-Vorprüfung und Wirkungsprüfung per MutationObserver (R-087, R-094)

**Dateien:**
- Anlegen `src/core/actions/effect.ts` und `tests/unit/effect.test.ts`.
- Ändern `src/core/bot.ts`: `doClick` und `waitForChange` durch `clickPrecheck` und `waitForEffect` ersetzen.

**Schnittstellen:**
- Liefert:
  - `clickPrecheck(el: Element | null): 'ok' | 'missing' | 'not-actionable'`
  - `waitForEffect(doc: Document, el: Element, before: string, signatureOf: () => string, timeoutMs: number): Promise<boolean>`. Ergibt `true`, sobald `el` abgehängt, unsichtbar oder nicht bedienbar ist oder `signatureOf() !== before`. Prüft sofort und bei jeder Mutation (MutationObserver auf `doc.documentElement`: `attributes`, `childList`, `characterData`, `subtree`). Ergibt `false` nach `timeoutMs`. Der Observer wird immer getrennt.
- **Bot:**
  - `'missing'` führt wie bisher zu `failed()`.
  - `'not-actionable'` erzeugt eine `debug`-Zeile „target not actionable yet: …“. Es gibt **keinen** Klick und **kein** `failed()`, der Aufruf kehrt sofort zurück. Die Schleife wartet mit Tempo.

- [ ] **Schritt 1: Failing Tests:**
  - `clickPrecheck: missing for null, not-actionable for a disabled button, ok for an enabled one`
  - `waitForEffect resolves true when the clicked button becomes disabled` (setTimeout setzt nach 50 ms `disabled`, `timeoutMs` 1000)
  - `… true when the button is removed`
  - `… true when the signature changes`
  - `… false after the timeout when nothing changes` (`timeoutMs` 100)
  - `… disconnects its observer` (Spy auf `MutationObserver.prototype.disconnect`, mindestens 1 Aufruf je Ausgang)
- [ ] **Schritt 2:** FAIL. **Schritt 3:** Umsetzen und im Bot verdrahten.
- [ ] **Schritt 4:** grün, die ganze Suite grün. **Schritt 5:** Commit „P3a T3: Klick nur auf bedienbare Ziele, Wirkungsprüfung per MutationObserver (R-087, R-094)“.

### Task 4: Watchdog und Einstellung `watchdogSec` (R-095)

**Dateien:**
- Anlegen `src/core/watchdog.ts` und `tests/unit/watchdog.test.ts`.
- Ändern:
  - `src/core/settings.ts`: `watchdogSec: number`, Standard 60, normalisiert auf 15–600
  - `src/ui/settings-form.ts`: `num('pk-watchdog', 'Watchdog (s)', …, 15, 600, 5)`
  - `src/core/pause-reason.ts`: neues Präfix `stalled`
  - `src/core/bot.ts`: Aufruf in `tick` nach `refresh`, nur bei `running`, und `reset()` in `start`/`pause`

**Schnittstellen:**
- Liefert `class Watchdog { constructor(now: () => number); observe(signature: string, limitMs: number): 'ok' | 'reread' | 'stall'; reset(): void }`.
  - Eine neue Signatur setzt zurück und ergibt `'ok'`.
  - Liegt die letzte Änderung mehr als `limitMs` zurück, kommt einmal `'reread'`.
  - Danach ergibt mehr als `limitMs × 1,5` den Wert `'stall'`.
  - `reset()` setzt die Zeit auf `now()` und vergisst `'reread'`.
- `errorPause('stalled', detail)`. `isErrorPause` erkennt `stalled: …`.
- **Bot:**
  - `'reread'` erzeugt `log.warn('watchdog: no change for Xs – re-reading')` und ein zusätzliches `refresh()`.
  - `'stall'` führt zu `pause(errorPause('stalled', 'no change for Xs on <screen>'), true)`.

- [ ] **Schritt 1: Failing Tests:**
  - `watchdog: ok while the signature changes`
  - `reread once after limit`
  - `stall after 1.5 × limit`
  - `reset after pause/start prevents an immediate stall`
  - `settings: watchdogSec defaults to 60 and is clamped to 15–600`
  - `pause-reason: stalled is an error pause`
- [ ] **Schritt 2:** FAIL. **Schritt 3:** Umsetzen und verdrahten.
- [ ] **Schritt 4:** grün, die ganze Suite und E2E grün. Das Einstellungsfeld erscheint im Overlay, E2E bleibt grün.
- [ ] **Schritt 5:** Commit „P3a T4: Watchdog mit Einstellung watchdogSec, Pause stalled (R-095)“.

### Task 5: Replay der Bosskampf-Zeitreihe, Live-Nachweis, Doku (R-190, R-087, R-095)

**Dateien:** Anlegen `tests/unit/battle-replay.test.ts`. Ändern docs: REQUIREMENTS-Nachweise, PROGRESS, CHANGELOG, GAME_RECON §12.8.

- [ ] **Schritt 1: Test** `battle-replay: a 16.7 s boss fight with SKIP disabled after the click never pauses and ends with a click on CONTINUE`.
  - Fixture `battle-gym`.
  - Zeitreihe aus GAME_RECON §12.8: SKIP aktiv, dann gesperrt, 17 KP-Wechsel im Abstand von bis zu 2 s, am Ende SKIP versteckt und WEITER sichtbar.
  - Je Schritt `decide()` aus der Engine aufrufen und `Watchdog.observe(detectScreen(doc).signature, 60_000)` mit Fake-`now()`.
  - Erwartet:
    - Zuerst ein Klick auf SKIP.
    - Danach nur `wait`.
    - Der Watchdog meldet nie `stall`.
    - Am Ende ein Klick auf `#btn-continue-battle`.
- [ ] **Schritt 2:** grün (die Bausteine aus T1 bis T4 existieren). Gegenprobe: Mit der alten Logik, also `shown` statt `isActionable` in der Engine, wäre der Test rot. Als Mutationsprobe einmal prüfen.
- [ ] **Schritt 3: Live-Lauf.** Befehl: `npm run build:chrome`, dann `PKBOT_OUT=artifacts/live LIVE=1 LIVE_MINUTES=10 npx playwright test tests/e2e/live.spec.ts --trace off --output=artifacts/live/pw`.
  - Erwartet: kein „action keeps failing … #btn-auto-battle“, `liveVerdict` leer bzw. nur gewollte Pausen.
  - Prüfprotokoll: Orden, Runs, Kampfdauern, Ende.
  - Kommt ein neuer Hänger, wird er dokumentiert und behoben bzw. als eigener Fund eingeplant.
- [ ] **Schritt 4: Doku.**
  - R-087, R-095 und R-010 mit Nachweis (Status nur ✅, wenn die Anforderung vollständig erfüllt ist, sonst 🟡 mit Lücke).
  - R-094 als 🟡 (nur die Wirkungsprüfung).
  - R-190 mit Prüfprotokoll des Live-Laufs.
  - CHANGELOG, PROGRESS.
- [ ] **Schritt 5:** Gesamt-Review (frischer Reviewer), Funde mit TDD beheben, Commit und Push.
