# P3c Not-Aus, unerwartete Fehler, Speicherprobleme: Umsetzungsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. In diesem Projekt läuft die Ausführung inline mit TDD (D-031, D-037, D-038, D-039), am Ende kommt ein frischer Gesamt-Review.

**Goal:**
- Pause hält den Bot sofort an, ohne „letzten“ Klick.
- Unerwartete Fehler der Bot-Welt erscheinen im Log und als Toast.
- Speicher, der nicht dauerhaft speichert, wird dauerhaft und verständlich angezeigt.

**Architecture:**
- Eine Epoche im `BotController` und eine Prüfung `live()` vor jeder Wirkung, auch im `Actor`.
- `installGlobalErrorHandlers` in `src/core/log/global-errors.ts`, verdrahtet in `src/app.ts`.
- `PlatformStorage.set` liefert `'volatile'`. Der Bot hält `view.storageProblem`, das Overlay zeigt `#pk-storage`, die Optionsseite nutzt denselben Text.

**Tech Stack:** TypeScript, Vitest (happy-dom), Playwright.

**Spec:** `docs/superpowers/specs/2026-11-27-p3c-not-aus-fehler-speicher-design.md` (D-039)

**Reihenfolge der Ausführung:** T1, T2, T3, T4.

## Global Constraints
- Nach `pause()` feuert der Bot kein Spiel-Event mehr (Klick, Taste, `openBagItem`). Eine abgebrochene Aktion bekommt `outcome: 'aborted'` und zählt nicht als Fehlschlag (R-011).
- Fehler von Skripten mit `filename` bzw. Stack-URL auf `location.origin` (dem Spiel) sind keine Bot-Fehler (R-200).
- Die Texte von R-259 stehen wörtlich im Spec, Abschnitt „Ziele“.
- Kein neuer Schreibzugriff außerhalb `pkbot.*` bzw. `chrome.storage.local` (R-145). Userscript bleibt ES2020 und Safari 15 (`npm run build` prüft). Die R-032-Grenzen gelten weiter.
- Die Lint-Regeln aus D-036 gelten.

## Review Focus
1. **Pause während einer Rückfrage an die Bridge** (`refresh` oder Simulation): Kommt die Antwort nach der Pause, darf daraus keine Aktion mehr werden. Test in T1.
2. **„Schritt“ bei pausiertem Bot:** Ein manueller Schritt muss weiter genau eine Aktion ausführen. Die Epoche darf `step()` nicht blockieren. Test in T1.
3. **Fehler aus dem Spiel selbst** (ErrorEvent mit `filename` auf pokelike.xyz): Sie dürfen weder Toast noch Log-Zeile `error` erzeugen. Test in T2.
4. **Viele gleiche unerwartete Fehler** (Fehler in einer Schleife): höchstens ein Toast je Text, kein Toast-Sturm. Test in T2.
5. **Speicher erholt sich** (nach „volatile“ wieder erfolgreich gespeichert): Der Hinweis verschwindet. Test in T3.

---

### Task 1: Not-Aus (R-011)

**Files:**
- Modify: `src/core/actions/actor.ts` (`click`, `pressKey`: optional `live`, Rückgabe `Promise<boolean>`)
- Modify: `src/core/bot.ts` (Epoche, `live` in `tick`, `doClick`, `doSwap`, `doReorder`, `doOpenBag`, `failed`)
- Modify: `src/core/log/run-log.ts` (`setOutcome`: auch `'aborted'`)
- Test: `tests/unit/not-aus.test.ts`

**Interfaces:**
- Produces:
  - `Actor.click(el: Element, live?: () => boolean): Promise<boolean>`
  - `Actor.pressKey(doc, code, key, mods?, live?): Promise<boolean>`
  - `RunRecorder.setOutcome(line, outcome: 'ok' | 'no-effect' | 'aborted')`

- [ ] **Step 1: Write the failing tests** (`tests/unit/not-aus.test.ts`, Fake-Plattform wie `tests/unit/bot-runlog.test.ts`):
  - „a pause during attachSim stops the tick before the click“: `attachSim` ruft `bot.pause('paused by user')` (Spy auf die private Methode). `tick()` → kein `actor.click`, `failCount` 0.
  - „a pause during the actor's micro delay fires no pointerdown and returns false“: `new Actor().click(btn, live)`. `live` wird nach dem ersten Aufruf `false`. Ein Listener für `pointerdown` wird nie gerufen, das Ergebnis ist `false`.
  - „a pause between two reorder presses sends no second key“: `doReorder` mit 2 Schritten. Nach dem ersten Tastendruck pausieren → genau 1 `keydown`.
  - „an aborted click is no failure and is logged as aborted“: Der Spy `actor.click` ruft `bot.pause()` und liefert `false`. Ergebnis: `outcome` `aborted`, `noEffect` 0, `failCount` 0.
  - „step() on a paused bot still performs exactly one action“ (Review Focus 2): pausierter Bot auf `title` → `step()` → genau ein Klick.
- [ ] **Step 2: Run** `npx vitest run tests/unit/not-aus.test.ts`. Erwartet: FAIL.
- [ ] **Step 3: Implement.**
  - `pause()` erhöht `epoch`. `tick()` bildet `live = () => this.epoch === ep` und prüft nach `refresh` und nach `attachSim`.
  - Jede `do*`-Methode bekommt `live` und prüft vor jeder Wirkung. `failed()` schläft nach einer Pause nicht.
  - Im Actor: Prüfung vor dem ersten Event und nach jeder `sleep`.
- [ ] **Step 4: Run** `npx vitest run && npm run lint && npm run typecheck`. Erwartet: grün.
- [ ] **Step 5: Commit** `P3c T1: Not-Aus – Pause wirkt sofort, auch mitten in Simulation, Klick und Tauschschritten (R-011)`, danach Push auf den Branch und `HEAD:main`.

### Task 2: Unerwartete Fehler (R-200)

**Files:**
- Create: `src/core/log/global-errors.ts`
- Modify: `src/core/bot.ts` (`reportUnexpected`, `onUnexpectedToast`), `src/app.ts` (Installation)
- Modify: `tests/e2e/userscript-host.ts` (`evaluateInUserscriptWorld(page, code)`), `tests/e2e/userscript.spec.ts`
- Test: `tests/unit/global-errors.test.ts`

**Interfaces:**
- Produces:
  - `installGlobalErrorHandlers(win: Window, onUnexpected: (where: string, err: unknown) => void): boolean` (gibt `false` zurück, wenn schon installiert)
  - `isGameError(win: Window, ev: { filename?: string; reason?: unknown; error?: unknown }): boolean`
  - `BotController.reportUnexpected(where: string, err: unknown): void`
  - `BotController.onUnexpectedToast: ((text: string) => void) | null`

- [ ] **Step 1: Write the failing tests:**
  - „a rejection from a ternary async handler on addEventListener is reported“: In happy-dom Handler installieren, dann ein Event `unhandledrejection` mit `reason` = Fehler aus `(cond ? async () => { throw … } : null)` simulieren. `onUnexpected` wird mit `'global:unhandledrejection'` gerufen.
  - „an ErrorEvent from a pokelike.xyz script is ignored“ (Review Focus 3): `filename: 'https://pokelike.xyz/js/game.js'` → kein Aufruf. `filename: 'chrome-extension://abc/content.js'` → Aufruf.
  - „a rejection whose stack points to the game origin is ignored“.
  - „installing twice reports once“.
  - Bot: „reportUnexpected logs an error line and toasts only the first time per text“ (Review Focus 4): 3 gleiche Meldungen ergeben 3 Log-Zeilen `error` und 1 Toast.
  - E2E Userscript (nur Chromium, isolierte Welt): Über `evaluateInUserscriptWorld` einen Button mit Ternär-Async-Handler anlegen und klicken. `#pk-log` enthält danach „unexpected: ternary handler rejection“.
- [ ] **Step 2: Run** `npx vitest run tests/unit/global-errors.test.ts`. Erwartet: FAIL.
- [ ] **Step 3: Implement.**
  - Ein Marker an `win` (`__pkbotGlobalErrors`) verhindert die doppelte Installation.
  - `app.ts` installiert nach dem Anlegen des Bots und setzt `bot.onUnexpectedToast = (t) => toast(t, 6000, doc)`.
- [ ] **Step 4: Run** `npx vitest run && npm run lint && npm run build && npx playwright test --project=userscript-desktop --trace off`. Erwartet: grün.
- [ ] **Step 5: Commit** `P3c T2: globale Handler für error/unhandledrejection in der Bot-Welt, Spiel-Fehler gefiltert, Log und Toast (R-200)`, danach Push.

### Task 3: Speicherprobleme (R-259)

**Files:**
- Create: `src/ui/storage-problem.ts`
- Modify: `src/platform/types.ts` (`set(): Promise<void | 'volatile'>`), `src/platform/userscript/storage.ts`, `src/core/bot.ts` (`persist`, `view.storageProblem`), `src/ui/overlay.ts` (`#pk-storage`), `src/platform/chrome/options.ts`
- Modify: `tests/e2e/userscript-host.ts` (`GmMode` `'volatile'`: GM und localStorage werfen), `tests/e2e/userscript.spec.ts`
- Test: `tests/unit/storage-problem.test.ts`, `tests/unit/userscript-storage.test.ts`

**Interfaces:**
- Produces:
  - `storageProblemText(p: unknown | 'volatile'): string`
  - `reportSave(p: Promise<unknown>, el: HTMLElement, okText: string): Promise<void>` (Optionsseite)
  - `BotView.storageProblem: string | null`

- [ ] **Step 1: Write the failing tests:**
  - `storageProblemText`:
    - `new Error('Extension context invalidated.')` → Text mit „Seite neu laden“.
    - `'volatile'` → Text mit „privates Surfen“ und „nur bis zum Neuladen“.
    - Sonst → „konnten nicht gespeichert werden: <Grund>“.
  - userscript-storage: „set returns 'volatile' when GM and localStorage both fail“ und „undefined when GM works“.
  - Bot:
    - „updateSettings with a throwing storage keeps the setting and shows the problem“.
    - „a later successful save clears the problem“ (Review Focus 5).
    - „saving the stats after a run end uses the same path“.
  - `reportSave`: Ein abgelehntes Promise schreibt den Problemtext ins Element, ein erfülltes den OK-Text.
  - E2E Userscript (`GmMode 'volatile'`): Eine Einstellung ändern → `#pk-storage` enthält „nur bis zum Neuladen“.
- [ ] **Step 2: Run** `npx vitest run tests/unit/storage-problem.test.ts tests/unit/userscript-storage.test.ts`. Erwartet: FAIL.
- [ ] **Step 3: Implement.**
  - `persist(key, value)` im Bot: try/catch. Fehler oder `'volatile'` setzen das Problem, Erfolg löscht es, danach `emit()`.
  - Das Overlay zeigt `#pk-storage` als `div.warn.bad`, solange das Problem besteht.
  - Die Optionsseite nutzt `reportSave` mit `#saved`.
- [ ] **Step 4: Run** `npx vitest run && npm run lint && npm run typecheck && npm run build && npx playwright test --trace off`. Erwartet: grün.
- [ ] **Step 5: Commit** `P3c T3: Speicherprobleme als dauerhafter Hinweis mit nächstem Schritt in Overlay und Optionsseite (R-259)`, danach Push.

### Task 4: Nachweise, Doku, Gesamt-Review

- [ ] **Step 1:** Nachweise eintragen in `docs/REQUIREMENTS.md` (R-011, R-200, R-259), dazu `CHANGELOG.md`, `docs/PROGRESS.md` und die Testzahlen in `CLAUDE.md`.
- [ ] **Step 2:** `npm test && npm run lint && npm run typecheck && npm run build && npx playwright test --trace off`. Erwartet: alles grün.
- [ ] **Step 3: Commit** `P3c: Nachweise R-011/R-200/R-259, CHANGELOG, PROGRESS`, danach Push.
- [ ] **Step 4:** Gesamt-Review durch einen frischen Reviewer über `base..HEAD`, mit dem Review Focus oben. Kritische und wichtige Funde mit TDD beheben, den Rest in PROGRESS eintragen.
