# Phase 1 – Bestandsaufnahme und Aufklärung: Implementierungsplan

> **Für agentische Ausführung:** laut D-025 gemischt. Kleine Code-Fixes (Task 1 und 2) inline mit superpowers:test-driven-development, die Bestandsaufnahme (Task 6) über parallele `requirements-reviewer`. Die Schritte nutzen Checkboxen (`- [ ]`).

**Goal:** Jede R-ID hat einen belegten Status, das Spielwissen ist live geprüft, und alle Live-Läufe sind fair.
**Architecture:** Zuerst zwei Sicherheitsfixes am bestehenden Code: Seeds aus dem sichtbaren Zustand und ein Actor-Guard. Dann WebKit plus volle Testläufe, Live-Aufklärung, Wiki, Bestandsaufnahme durch Reviewer und am Ende das Review-Tor.
**Tech Stack:** TypeScript strict, Vitest (happy-dom), Playwright 1.63 (Chromium vorinstalliert, WebKit nach D-011), esbuild.
**Spec:** `docs/superpowers/specs/2026-11-25-phase1-design.md`

## Global Constraints
- Live-Läufe nur mit frischem, nicht eingeloggtem Profil. Cloud-Save-Endpunkte bleiben blockiert, wie in `tests/e2e/live.spec.ts` (R-228).
- Kein Schreiben in Spiel-Storage oder Spielfunktionen außer D-018/D-019 (R-145, R-238).
- Neue Fixtures und Logs werden vor dem Commit auf Tokens und Personendaten geprüft (R-148, R-210). Private Stände kommen nur nach `tests/fixtures/private/`.
- ✅ nur mit Test, Screenshot oder Prüfprotokoll in der R-Zeile (CLAUDE.md Regel 4).
- Nach jedem Task: PROGRESS.md aktualisieren, committen, Session-Branch und `main` per Fast-Forward pushen.

## Review Focus
1. **Zielelement liegt im Reset-Button**, z. B. ein Icon- oder `span`-Kind von `[data-menu="reset"]`. Der Guard muss über `closest()` greifen, nicht nur bei exaktem Treffer (Test in Task 2).
2. **Das tatsächlich getroffene Element** (`topmostAt`) ist ein anderes als das gewünschte, etwa ein Overlay über dem Reset-Button. Der Guard prüft auch das Ziel unter dem Klickpunkt (Test in Task 2).
3. **Gleicher sichtbarer Zustand, anderer versteckter Seed** (`runSeed`, `rngSeed` und die Zufallszahlen des Spiels). Die Sim-Seeds müssen identisch sein (Test in Task 1).
4. **Team mit `null`-Slots oder fehlenden Feldern** (`currentHp` undefiniert). `simBase` darf nicht werfen und muss stabil bleiben (Test in Task 1).
5. **Ein Live-Lauf hängt oder pausiert früh.** Dann zählt der Grund (`pauseReason`, Log) als Befund in GAME_RECON bzw. PROGRESS, nicht als „Test bestanden“ (Task 4).

---

### Task 1: Simulations-Seeds aus dem sichtbaren Zustand (R-239, R-248, R-030)
**Files:**
- Create: `src/core/bridge/sim-seed.ts`
- Modify: `src/core/bridge/simulator.ts`: Seed-Ableitungen in Z. 339, 473, 522 (`chainRate`) und 809. Den Kopfkommentar und `src/core/bridge/page-bridge.ts:4` („never mutates“) korrekt formulieren: Seed und Zähler werden vorübergehend gesetzt und wiederhergestellt.
- Test: `tests/unit/sim-seed.test.ts`

**Interfaces:**
- Produces: `fnv1a32(s: string): number` · `visibleKey(st: VisibleState | null | undefined): string` · `simBase(st: VisibleState | null | undefined): number` · `type VisibleState = { currentMap?: unknown; currentNodeId?: unknown; isEndlessMode?: unknown; team?: ({ speciesId?: number; level?: number; currentHp?: number } | null)[] }`
- In `simulator.ts`: Jede exportierte Sim-Funktion berechnet einmal `const sb = simBase(state)` und ersetzt in den `seedRng(...)`-Ableitungen `seed0`/`base` durch `sb`. `chainRate` bekommt `sb` als Parameter statt `getRngSeed()`. `getRngSeed()` steht danach **nur** noch in `const seed0 = getRngSeed()` und `out.restored = getRngSeed() === seed0`.

- [ ] **Step 1: Failing tests** in `tests/unit/sim-seed.test.ts`:
  - `simBase` ist gleich bei gleichem sichtbarem Zustand und unterschiedlichen `runSeed`/`rngSeed`: `simBase({...s, runSeed: 1, rngSeed: 2}) === simBase({...s, runSeed: 9, rngSeed: 8})`.
  - `simBase` ändert sich, wenn sich `team[0].level`, `currentHp` oder `currentNodeId` ändert.
  - `simBase({team: [null, {speciesId: 1}]})` wirft nicht und liefert eine Zahl `>= 0` und `< 2**32`. `simBase(null)` ebenso.
  - Quelltext-Check: `readFileSync('src/core/bridge/simulator.ts')` enthält kein `seedRng((seed0` und kein `getRngSeed() ^`, und `getRngSeed()` kommt nur in den beiden erlaubten Mustern vor (Regex über alle Vorkommen).
- [ ] **Step 2:** `npx vitest run tests/unit/sim-seed.test.ts` → FAIL (Modul fehlt).
- [ ] **Step 3:** Implementiere `sim-seed.ts`: FNV-1a 32 Bit über `visibleKey` (JSON aus `[currentMap, currentNodeId, isEndlessMode, team.map(m => m ? [speciesId, level, currentHp] : null)]`). Danach die Aufrufstellen in `simulator.ts` umstellen.
- [ ] **Step 4:** `npx vitest run` → alle grün (bisher 98 plus neue), `npx tsc --noEmit` → 0 Fehler, `npm run lint` → 0.
- [ ] **Step 5:** R-248 auf ✅ setzen (Nachweis: Testname). R-239 wird 🟡 (Seeds erfüllt, der Wiederherstellungstest im Browser folgt in P4). STRATEGY.md §Kernidee um einen Satz zu den Seeds ergänzen. PROGRESS.md aktualisieren, committen, pushen.

### Task 2: Actor-Guard gegen Reset, Logout und verbotene Tasten (R-147, Teil von R-165)
**Files:**
- Create: `src/core/actions/guard.ts`
- Modify: `src/core/actions/actor.ts` (`click`, `drag`, `pressKey`) und `src/core/bot.ts` (Fehlerpfad Z. ~190: Bei `ForbiddenActionError` pausieren mit dem Grund `blocked: <regel>`, ohne Wiederholung)
- Test: `tests/unit/guard.test.ts`

**Interfaces:**
- Produces: `FORBIDDEN_TARGETS: readonly string[]` = `['[data-menu="reset"]', '[data-menu="account"]', '[onclick*="confirmResetRun"]', '#reset-run-modal', '.reset-run-modal']` · `isForbiddenTarget(el: Element): string | null` (Treffer über `el.closest(sel)`, liefert die Regel) · `isKeyAllowed(code: string, key: string, mods: { shift?: boolean; alt?: boolean }): boolean` (nur `Digit1`–`Digit6` mit `shift: true`, ohne `alt`) · `class ForbiddenActionError extends Error { rule: string }`
- `Actor.click(el)` und `Actor.drag(from, to)` werfen `ForbiddenActionError`, wenn `el`, `from`, `to` oder das Ziel unter dem Klickpunkt (`topmostAt`) verboten ist. Das wird geprüft, **bevor** ein Event feuert. `Actor.pressKey` wirft, wenn `!isKeyAllowed`.

- [ ] **Step 1: Failing tests** in `tests/unit/guard.test.ts`, mit `loadFixture('map')`:
  - `isForbiddenTarget(doc.querySelector('[data-menu="reset"]'))` ist `'[data-menu="reset"]'`. Für ein Kindelement darin gilt dasselbe (Element anhängen). Für `[data-menu="account"]` greift die eigene Regel, für `#run-menu-toggle` und einen `g.map-node` gibt es `null`.
  - `isKeyAllowed('KeyR','r',{})`, `('KeyR','R',{shift:true})` und `('Digit3','3',{})` liefern `false`. `('Digit3','3',{shift:true})` liefert `true`, `('Digit7','7',{shift:true})` liefert `false`.
  - `await expect(new Actor({microDelay:0}).click(resetBtn)).rejects.toBeInstanceOf(ForbiddenActionError)`, und es wurde **kein** `click`-Event gefeuert (Listener-Zähler 0). Dasselbe für `pressKey(doc,'KeyR','r')`.
- [ ] **Step 2:** `npx vitest run tests/unit/guard.test.ts` → FAIL.
- [ ] **Step 3:** `guard.ts` implementieren, die Prüfungen in `actor.ts` einbauen und in `bot.ts` den Fehler abfangen (pausieren und loggen, nicht wiederholen).
- [ ] **Step 4:** `npx vitest run`, `npx tsc --noEmit` und `npm run lint` → grün.
- [ ] **Step 5:** R-147 bleibt 🟡 (Nachweis: Testnamen). Offen ist die Erlaubnis per Einstellung (R-165, P5). PROGRESS.md aktualisieren, committen, pushen.

### Task 3: WebKit und volle Testläufe (R-065, Vorarbeit R-015 und R-016)
**Files:** keine im Repo, außer Docs und, nach Freigabe, dem Setup-Skript der Umgebung.
- [ ] **Step 1:** `npx playwright --version` (Projektversion) und `npx playwright install webkit`. Danach `npx playwright install-deps webkit`, alternativ `apt-get install` der gemeldeten Bibliotheken. Erwartet: keine fehlenden Bibliotheken mehr.
- [ ] **Step 2:** `npm run build && npx playwright test --trace off` → alle drei Projekte grün (`chrome-extension`, `userscript-chromium`, `userscript-webkit-iphone`). Ergebnis und Laufzeit kommen in PROGRESS.md.
- [ ] **Step 3:** `get_environment`, dann Setup-Skript vorschlagen (`update_environment` bzw. `create_environment`). Es enthält nur die in Step 1 erfolgreich gelaufenen Befehle, idempotent. Freigabe gibt der Nutzer.
- [ ] **Step 4:** R-065 auf ✅ setzen (Prüfprotokoll: Befehle plus grüne WebKit-Tests). In D-011 das Ergebnis nachtragen. Committen, pushen.

### Task 4: Live-Aufklärung (R-036, R-066 bis R-073, R-075 bis R-077, R-224)
**Files:**
- Create: `scripts/recon/read-game.mjs`. Es öffnet pokelike.xyz mit frischem Profil in Chromium und liest im Hauptkontext nur lesend aus: Version (`PATCH_NOTES[0].version`), Meta-CSP, ob ein Test-Script per script-Element läuft (setzt nur `window.__pkCspTest`), Liste der Knotentypen und Bildschirm-IDs aus dem DOM, Item-Pools (`ITEM_POOL`/`USABLE_ITEM_POOL`/`PASSIVE_ITEM_POOL`: Items, die den Angriffstyp ändern), `computeTraitTiers`-Quelltext (Schwelle 2 Punkte), Nuzlocke-Regeln (Funktionen mit `nuzlocke`), Shop-Währung (`shop`/`mart`-Funktionen). Ausgabe nach `artifacts/recon/*.json`.
- Modify: `docs/GAME_RECON.md` (§10.1 vervollständigen, §10.5/§10.7 beantworten, neue Bildschirme), `tests/fixtures/dom/` (neue Bildschirme, bereinigt)
- [ ] **Step 1:** `node scripts/recon/read-game.mjs` → JSON-Dateien. Die Befunde mit Quelle (Funktionsname, Version) in GAME_RECON eintragen.
- [ ] **Step 2:** Live-Lauf `LIVE=1 LIVE_MINUTES=12 npm run e2e:live`, Story Classic mit frischem Profil. `test-results/live-run.json`, `live-run.log` und `live-run.png` auswerten: Bildschirme, Fortschritt, Pausen. Ein Hänger oder ein unbekannter Bildschirm wird ein Befund (Review Focus 5).
- [ ] **Step 3:** Fixtures für Bildschirme, die im Lauf neu auftauchen, über das bestehende Snapshot-Verfahren sichern (Skripte entfernen, auf Personendaten prüfen). Pro neuem Fixture ein Detector-Test in `tests/unit/detector.test.ts`, der den Bildschirm erkennt oder **als unbekannt pausiert** (R-224).
- [ ] **Step 4:** DE/EN belegen: Die vorhandenen Paare `catch-de`/`catch-en` und `starter-de`/`starter-en` erkennt der Detector gleich (bestehende Tests nennen bzw. ergänzen), dazu ein Verweis auf D-020.
- [ ] **Step 5:** R-036 und R-066 bis R-077 nach Nachweis setzen (✅ bzw. 🟡 mit Lücke), R-224 ebenso. Committen, pushen.

### Task 5: Wiki-Quellen (R-064)
- [ ] **Step 1:** pokelike.wiki (`/battle-tower/`, `/guides/kanto/`, `/traits/`, `/items/`) und pokelike-guide.fr lesen. Festhalten, welche Daten zu Gegner-Teams, Items und Traits es gibt, in welcher Form und für welche Version, und wo sie dem Spielcode widersprechen.
- [ ] **Step 2:** GAME_RECON §11 „Externe Quellen“ mit URL, Abrufdatum und Bewertung anlegen. R-064 ✅ (Prüfprotokoll). Committen, pushen.

### Task 6: Bestandsaufnahme aller R-IDs (PLAN P1)
- [ ] **Step 1:** Parallel 4× `requirements-reviewer`, nur lesend. Gruppen: (a) A, B, C, D · (b) E, F, H, N · (c) G, J · (d) I, K, L, M, O, P, Z. Auftrag jeweils: pro R-ID eine Tabelle mit R-ID, vorgeschlagenem Status, Nachweis (Testname, Datei:Zeile, Befehl) oder Fundstelle und der Lücke. ✅ nur mit einem selbst gesehenen oder ausgeführten Nachweis.
- [ ] **Step 2:** Die Tabellen in REQUIREMENTS.md eintragen (Status und Nachweis). Bei Widersprüchen selbst prüfen. Danach `scripts/check-hook-budget.sh` → OK.
- [ ] **Step 3:** Committen, pushen.

### Task 7: Zielwert, R-020 und Review-Tor (R-230, R-020)
- [ ] **Step 1:** Zielwert für R-230 aus STRATEGY.md (Variante A: Ø 3,2 Orden über 12 Runs) und dem Live-Lauf ableiten. Vorschlag: Story Classic Kanto, über mindestens 20 Runs Ø ≥ 5 Orden und mindestens 1 Champion-Sieg, für P4 als Messlatte. Als D-Eintrag festhalten.
- [ ] **Step 2:** R-020 dokumentieren: In der Cloud nicht unterscheidbar. Der Nachweis gelingt nur lokal, deshalb bleibt R-020 🟡 mit Hinweis, oder er wird per D-Eintrag nach P2 verschoben.
- [ ] **Step 3:** Eigenes Review, danach parallel `requirements-reviewer`, `ui-reviewer` und `strategy-reviewer`. Funde beheben und erneut prüfen. Danach PROGRESS auf **P2** setzen, committen, pushen.
