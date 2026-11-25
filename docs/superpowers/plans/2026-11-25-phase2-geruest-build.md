# Phase 2 – Gerüst und Build: Umsetzungsplan

> **Für ausführende Agenten:** PFLICHT-SKILL: superpowers:executing-plans (inline, D-031) bzw. superpowers:subagent-driven-development. Schritte als Checkboxen (`- [ ]`).

**Ziel:** Das Userscript erfüllt HA §4 nachweislich. Automatische Checks verhindern Rückfälle bei GM-APIs, Metadaten, Import-Grenzen, stillen Fehlern und Doku-IDs. Der Hook warnt vor nicht gemergten Branches.

**Architektur:**
- Reine Prüf- und Erzeugungsfunktionen in `scripts/*.mjs` bzw. `src/**`, getestet mit Vitest.
- Regeln als ESLint-Konfiguration mit einer lokalen Regel `local/no-silent-catch`.
- `build.mjs` erzeugt den Metadaten-Block aus der tatsächlichen Nutzung und bricht bei Verstößen ab.

**Tech-Stack:** TypeScript, esbuild, ESLint 9 (Flat Config), Vitest (happy-dom), Playwright, bash.

**Spec:** `docs/superpowers/specs/2026-11-25-phase2-design.md` · Entscheidungen D-031, D-032

## Globale Vorgaben
- Erlaubte GM-API, die Schnittmenge aus R-099: `GM.getValue`, `GM.setValue`, `GM.deleteValue`, `GM.listValues`, `GM.addStyle`, `GM.setClipboard`, `GM.info`. **Keine** `GM_*`-Legacy-APIs.
- Fallback-Präfix für localStorage: `pkbot.`. Nie `poke_*` oder `pkrl_*` schreiben (R-145, D-031).
- Update-Links:
  - `@updateURL https://raw.githubusercontent.com/itzmaagiic/xyz-bot/main/dist/pokelike-bot.meta.js`
  - `@downloadURL https://raw.githubusercontent.com/itzmaagiic/xyz-bot/main/dist/pokelike-bot.user.js`
- Userscript und eingebettete Bridge: `target: ['es2020']`, nicht minifiziert, kein `@require`. Die Chrome-Bundles bleiben bei `['chrome111', 'safari15']`.
- `src/core/**` und `src/ui/**` importieren aus `platform/` nur `platform/types`.
- Nach jedem Task `npm test`, `npm run typecheck` und `npm run lint` grün. Dann committen, auf den Branch pushen, `main` per Fast-Forward nachziehen und PROGRESS aktualisieren.

## Review-Fokus
1. **GM fehlt ganz** (Skript in einem Manager ohne `GM`-Objekt bzw. Grant): Der Bot startet trotzdem, Einstellungen überleben einen Reload über `pkbot.*`. Test in T3.
2. **GM wirft bei einem Aufruf**, etwa iOS mit vollem Speicher oder ein Quota-Fehler: Kein Absturz, Fallback auf localStorage, `recentErrors()` enthält den Fehler. Test in T3.
3. **Alter gespeicherter Wert ohne JSON** (Rohstring aus einer Vorversion): `get` liefert `undefined` und vermerkt den Fehler, statt zu werfen. Test in T3.
4. **Bridge-Code mit Backtick, `${` oder Backslash:** Die Einbettung als Template-Literal liefert byte-genau den Originaltext. Test in T4.
5. **Hook ohne Netz bzw. ohne `origin`:** Kein Abbruch, keine Wartezeit über 5 s, eine Hinweiszeile statt einer Warnung. Test in T7.

---

### Task 1: Keine stillen Fehler (R-199)

**Dateien:**
- Anlegen: `src/core/log/note.ts`, `eslint-rules/no-silent-catch.mjs`, `tests/unit/note.test.ts`, `tests/unit/no-silent-catch.test.ts`
- Ändern:
  - `eslint.config.js`: lokales Plugin `local`, Regel für `src/**/*.ts`
  - `tsconfig.json`: `allowJs: true`, damit die Tests `.mjs` importieren können
  - alle catch-Stellen aus `grep -rn "catch" src` (Liste im Spec bzw. in der Zusammenfassung von P2)

**Schnittstellen:**
- Liefert:
  - `noteError(where: string, err: unknown): void`
  - `recentErrors(): readonly NotedError[]`
  - `clearNotedErrors(): void`
  - `interface NotedError { where: string; msg: string; count: number; t: number }`
- Die Regel `local/no-silent-catch` meldet:
  - einen `CatchClause`, dessen Block keinen `ThrowStatement` und keinen Aufruf von `noteError(…)` bzw. `<x>.error(…)`/`<x>.warn(…)` enthält
  - `.catch(fn)` mit einer Funktion, deren Rumpf keinen solchen Aufruf enthält, zum Beispiel `() => undefined`

- [ ] **Schritt 1: Failing Tests.** In `note.test.ts`:
  - `dedupes same where+msg and counts`: Zweimal `noteError('a', new Error('x'))` ergibt einen Eintrag mit `count: 2`.
  - `keeps at most 50 entries`: 60 verschiedene ergeben `recentErrors().length === 50`, die ältesten fallen weg.
  - `accepts non-Error values`: `noteError('b', 'str')` ergibt `msg === 'str'`.

  In `no-silent-catch.test.ts` mit `RuleTester` aus `eslint`, wobei `RuleTester.describe/it/itOnly` auf die Vitest-Funktionen gesetzt werden und der Parser aus `typescript-eslint` kommt:
  - gültig: `try{f()}catch(e){noteError('x',e)}`, `try{f()}catch(e){throw e}`, `try{f()}catch(e){this.log.warn('x',e)}`, `p.catch((e)=>noteError('x',e))`
  - ungültig mit `messageId: 'silent'`: `try{f()}catch{/* c */}`, `try{f()}catch(e){return null}`, `p.catch(()=>undefined)`, `p.catch(()=>null)`

- [ ] **Schritt 2:** `npx vitest run tests/unit/note.test.ts tests/unit/no-silent-catch.test.ts`. Erwartet ist FAIL, weil die Module fehlen.

- [ ] **Schritt 3: Umsetzen.**
  - `note.ts`: Ringpuffer mit 50 Einträgen und Dedupe über den Schlüssel `where|msg`. Zusätzlich `console.debug('[pkbot]', where, msg)`, aber nur beim ersten Auftreten eines Schlüssels.
  - Regel: Durch den Block laufen, verschachtelte Funktionen nicht mitzählen.
  - In `eslint.config.js` mit `files: ['src/**/*.ts']` als `'local/no-silent-catch': 'error'` registrieren.

- [ ] **Schritt 4:** Tests grün. `npm run lint` listet jetzt alle stillen Stellen. Diese **einzeln** beheben:
  - Echter Fallback: `noteError('<datei>:<zweck>', e)` und Rückgabewert wie bisher.
  - Absichtlich ignorierte Wirkung: `.catch((e) => noteError('…', e))`.
  - Kein Verhalten ändern.
  - Hinweis: `page-bridge.ts` und `simulator.ts` laufen in der MAIN-Welt. `noteError` landet dort im Puffer der Bridge, das ist so gewollt. Ob die Bridge diese Fehler meldet, entscheidet P3 (R-249).

- [ ] **Schritt 5:** `npm test && npm run typecheck && npm run lint` sind grün. Commit „R-199: noteError + ESLint-Regel no-silent-catch, alle stillen catch-Stellen behoben“.

### Task 2: Import-Grenzen (R-032)

**Dateien:** Ändern `eslint.config.js`. Test `tests/unit/boundaries.test.ts`.

**Schnittstellen:** Für `src/core/**/*.ts` und `src/ui/**/*.ts` gelten:
- `no-restricted-imports` mit `patterns: [{ group: ['**/platform/chrome/**', '**/platform/userscript/**', '**/platform/clipboard*'], message: '…R-032' }]`
- `no-restricted-globals` gegen `chrome`, `GM`, `GM_info`, `GM_getValue`, `GM_setValue`, `browser`

- [ ] **Schritt 1: Failing Test** `boundaries.test.ts` mit `new ESLint({ cwd: repoRoot })` und `lintText(code, { filePath })`:
  - `src/core/x.ts` mit `import { a } from '../platform/chrome/content'` ergibt einen Fehler mit `ruleId === 'no-restricted-imports'`.
  - `src/ui/x.ts` mit `chrome.storage.local.get('a')` ergibt `no-restricted-globals`.
  - `src/core/x.ts` mit `GM.getValue('a')` ergibt `no-restricted-globals`.
  - `src/core/x.ts` mit `import type { Platform } from '../platform/types'` ergibt 0 Fehler.
  - `src/platform/chrome/x.ts` mit `chrome.storage.local.get('a')` ergibt 0 Fehler dieser beiden Regeln.

- [ ] **Schritt 2:** Ausführen, FAIL.
- [ ] **Schritt 3:** Regeln in `eslint.config.js` ergänzen.
- [ ] **Schritt 4:** Test grün, `npm run lint` grün über das ganze Repo.
- [ ] **Schritt 5:** Commit „R-032: Import-Grenzen core/ui gegen platform per ESLint, mit Test“.

### Task 3: Userscript-Speicher und Zwischenablage nur mit der GM-Schnittmenge (R-099, R-100, R-102)

**Dateien:**
- Anlegen: `src/platform/userscript/storage.ts`, `tests/unit/userscript-storage.test.ts`
- Ändern: `src/platform/userscript/main.ts` (Legacy-`declare`s und `GM_*` entfernen, `makeStorage` importieren, `copyText` nur über `GM.setClipboard` mit `copyViaDom` als Fallback)

**Schnittstellen:**
- Verwendet: `noteError` aus T1.
- Liefert:
  - `interface StorageEnv { gm?: { getValue?: (k: string) => Promise<unknown>; setValue?: (k: string, v: string) => Promise<void> } | null; local?: Pick<Storage, 'getItem' | 'setItem'> | null }`
  - `makeStorage(env: StorageEnv): PlatformStorage`
  - `export const LOCAL_PREFIX = 'pkbot.'`
- `onChange` ist im Userscript ein No-op: ein Kontext pro Tab, das Overlay schreibt selbst. `GM.addValueChangeListener` wird nicht genutzt (YAGNI, D-031).

- [ ] **Schritt 1: Failing Tests:**
  - `uses GM when present`: Ein GM-Stub speichert. `set('s',{a:1})` führt zu `gm.setValue('s','{"a":1}')`. `get('s')` liefert `{a:1}`. localStorage wird **nicht** angefasst.
  - `falls back to localStorage with pkbot. prefix when GM missing`: `gm: null`. `set('s',{a:1})` führt zu `local.getItem('pkbot.s') === '{"a":1}'`. Ein zweites `makeStorage` mit demselben `local` liefert über `get('s')` wieder `{a:1}` (Reload).
  - `falls back when GM throws and notes the error`: `setValue` wirft. Der Wert landet in `pkbot.s`, und `recentErrors()` enthält einen Eintrag mit `where` passend zu `/userscript\/storage/`.
  - `never writes game keys`: Nach `set('poke_x',1)` liegen alle `setItem`-Schlüssel unter `pkbot.` (also `pkbot.poke_x`).
  - `memory fallback when both missing`: `gm: null, local: null`. `set` und dann `get` liefern den Wert, kein Wurf.
  - `corrupt JSON returns undefined and notes`: `getValue` liefert `'{kaputt'`. Ergebnis `undefined`, ein Fehler ist vermerkt.

- [ ] **Schritt 2:** FAIL. **Schritt 3:** Umsetzen. In `main.ts` `makeStorage({ gm: typeof GM !== 'undefined' ? GM : null, local: safeLocalStorage() })`, wobei `safeLocalStorage` den Zugriff in try/catch mit `noteError` kapselt.
- [ ] **Schritt 4:** Grün. Außerdem `grep -n "GM_" src` ohne Treffer.
- [ ] **Schritt 5:** Commit „R-099/R-100/R-102: Userscript-Speicher nur GM-Schnittmenge, Fallback localStorage pkbot.*, Tests“.

### Task 4: Userscript-Build, Metadaten und Bundle-Check (R-034, R-103, R-104, R-105, R-107, R-192, R-193)

**Dateien:**
- Anlegen: `scripts/userscript-meta.mjs`, `scripts/check-userscript.mjs` (CLI für ein vorhandenes `dist/`), `tests/unit/userscript-meta.test.ts`, `tests/unit/userscript-build.test.ts`
- Ändern:
  - `scripts/build.mjs`: Userscript- und Bridge-Build mit `target: ['es2020']`, `minify: false`. Ausgabeverzeichnis über `PKBOT_DIST`. Nach dem Schreiben `checkUserscript`, bei Fehlern `process.exit(1)`.
  - `package.json`: `"check:userscript": "node scripts/check-userscript.mjs"`

**Schnittstellen:** Liefert aus `scripts/userscript-meta.mjs`:
- `ALLOWED_GM: readonly string[]` mit den sieben Namen ohne Präfix, z. B. `'getValue'`
- `NO_GRANT_NEEDED: readonly string[]` = `['info']`, gemäß R-098-Abgleich, sonst anpassen
- `usedGmApis(code: string): { gm: string[]; legacy: string[] }` liefert sortiert, eindeutig, aus `/\bGM\.(\w+)/g` und `/\bGM_(\w+)/g`
- `toTemplateLiteral(s: string): string` liefert ein Backtick-Literal, das zur Laufzeit genau `s` ergibt
- `buildMeta({ version, description, grants }): string` mit Reihenfolge `@name, @namespace, @version, @description, @match ×2, @run-at document-idle, @inject-into content, @noframes, @grant…, @updateURL, @downloadURL`, eingerahmt von `// ==UserScript==` und `// ==/UserScript==`, ohne `@require`
- `checkUserscript({ userJs, metaJs, version }): string[]` liefert die Fehlertexte, leer heißt OK

**Was der Check prüft:**
- Pflichtschlüssel mit exakten Werten nach R-103 und R-105; `@version === version` und SemVer
- kein `@require`
- `@grant` == `gm` minus `NO_GRANT_NEEDED`, jedes davon in `ALLOWED_GM`
- `legacy` leer
- `userJs` beginnt mit `metaJs`
- keine `??=`, `||=` oder `&&=`
- kein Codezeilenblock mit mehr als 400 Zeichen außer in String-Literalen. Vereinfacht: Höchstens 2 Zeilen über 400 Zeichen, sonst gilt es als minifiziert.

- [ ] **Schritt 1: Failing Tests** in `userscript-meta.test.ts`:
  - `usedGmApis finds GM.x and GM_x`
  - `toTemplateLiteral round-trips`: für ``'a`b${c}\\d\n e'`` gilt `new Function('return ' + toTemplateLiteral(s))() === s`
  - `buildMeta has update/download URLs and no @require`
  - `checkUserscript flags`: je ein Fall für `GM_getValue` im Code, `GM.openInTab` im Code, ein fehlendes `@grant GM.setValue` bei Nutzung, ein überflüssiges `@grant`, `@require`, ein falsches `@updateURL`, `??=`, eine Versionsabweichung; ein sauberer Fall ergibt `[]`

  In `userscript-build.test.ts` läuft `execFileSync('node', ['scripts/build.mjs','userscript'], { env: { ...process.env, PKBOT_DIST: tmp } })` mit einem Timeout von 60 s. Danach gilt:
  - `checkUserscript` auf die Ausgabe ergibt `[]`
  - die Ausgabe enthält `@updateURL`
  - die Bridge ist mehrzeilig eingebettet (die Ausgabe enthält die Zeile `function serializeMon` bzw. einen anderen Funktionsnamen aus `page-bridge.ts` am Zeilenanfang nach Einrückung)

- [ ] **Schritt 2:** FAIL.
- [ ] **Schritt 3: Umsetzen.** Die Bridge wird mit `define: { __BRIDGE_CODE__: '__PKBOT_BRIDGE_SRC__' }` gebaut. Danach ersetzt eine Textersetzung im Ergebnis **genau ein** Vorkommen von `__PKBOT_BRIDGE_SRC__` durch `toTemplateLiteral(bridge)`. Ist das Vorkommen nicht genau einmal da, bricht der Build ab.
- [ ] **Schritt 4:** Grün. `npm run build && npm run check:userscript` gibt „userscript OK“ aus. `npx playwright test --trace off --project userscript-chromium` ist grün.
- [ ] **Schritt 5:** Commit „R-104/R-105/R-107/R-192/R-193: Metadaten aus Nutzung, Update-URLs, unminifizierte ES2020-Bridge, Bundle-Check“.

### Task 5: E2E-Projekte nach UI.md §1 und Live-Test mit Fehler-Pausen (R-033, R-082)

**Dateien:**
- Anlegen: `src/core/pause-reason.ts`, `tests/unit/pause-reason.test.ts`
- Ändern: `playwright.config.ts`, `tests/e2e/live.spec.ts`

**Schnittstellen:** `isErrorPause(reason: string | null): boolean` ist `true` bei `/^(action keeps failing|internal error|blocked):/`.

- [ ] **Schritt 1: Failing Test:**
  - `isErrorPause('action keeps failing: x') === true`, ebenso für `internal error: …` und `blocked: …`
  - `false` für `paused by user`, `run finished: …`, `null` und `unknown screen …`

- [ ] **Schritt 2:** FAIL.

- [ ] **Schritt 3: Umsetzen.**
  - Projekte in `playwright.config.ts`:
    - `chrome-extension`: Chromium, 1440×900
    - `userscript-desktop`: Chromium, 1440×900
    - `userscript-iphone`: `{...devices['iPhone 13'], viewport: {width: 390, height: 844}}`
    - `userscript-iphone-safari`: `devices['iPhone 13']`
    - `userscript-iphone-se`: `devices['iPhone SE (3rd gen)']`
  - Die Strings, mit denen `bot.ts` pausiert, nach `pause-reason.ts` als Konstanten verschieben, damit Test und Bot dieselben Präfixe nutzen.
  - `live.spec.ts` endet mit `expect(isErrorPause(pauseReason), \`error pause: ${pauseReason}\`).toBe(false)`.

- [ ] **Schritt 4:** `npm test` grün. `npm run e2e` ist grün mit allen Projekten, die Zahl wird im Prüfprotokoll notiert.
- [ ] **Schritt 5:** Commit „R-033/R-082: E2E-Viewports nach UI.md §1, Live-Test wertet Fehler-Pausen als Fehlschlag“.

### Task 6: `npm run check:docs` (R-246)

**Dateien:** Anlegen `scripts/check-docs.mjs` und `tests/unit/check-docs.test.ts`. Ändern `package.json` (`"check:docs": "node scripts/check-docs.mjs"`).

**Schnittstellen:** `checkDocs({ requirements, plan, decisions, others, previousRequirements }): string[]` mit den Texten als Strings. `others` ist ein Array `{ name, text }`. `previousRequirements` ist optional, der Text aus `git show HEAD:docs/REQUIREMENTS.md`. Die CLI liest die Dateien und gibt die Fehler mit Exit 1 aus.

**Was geprüft wird:**
- R-Zeilen (`^- (✅|🟡|❌) \*\*R-(\d{3})\*\* \[P(\d)\]`) sind eindeutig und lückenlos ab R-001.
- „Nächste freie ID: **R-NNN**“ ist max+1.
- Jede R-Zeile hat einen Tag P0–P7.
- Tag gegen PLAN, in beide Richtungen: Eine ID im `**R-IDs:**`-Block von Phase n, wobei Bereiche „R-a bis R-b“ aufgelöst werden, hat Tag `[Pn]`. Ausnahme: ✅-Zeilen dürfen in einer späteren Phase erneut gelistet sein. Jede R-Zeile mit Tag `[Pn]` steht in PLAN Phase n.
- Jede erwähnte `R-\d{3}` bzw. `D-\d{3}` in allen Dateien existiert.
- ✅-Zeilen enthalten kein `**Lücke:**`.
- Keine ID aus `previousRequirements` fehlt (Schutz des Gedächtnisses).

- [ ] **Schritt 1: Failing Tests** mit Mini-Dokumenten:
  - `ok case`
  - `duplicate id`
  - `gap`
  - `wrong next id`
  - `tag not in plan`
  - `unknown R ref in other doc`
  - `unknown D ref`
  - `✅ with Lücke`
  - `id removed vs previous`

- [ ] **Schritt 2:** FAIL. **Schritt 3:** Umsetzen.
- [ ] **Schritt 4:** `npm run check:docs` gegen die echten Docs ausführen. Jeden Fund **an den Daten** beheben (PLAN-Liste bzw. Tag). Geänderte Tags bekommen einen D-Eintrag bzw. stehen im Commit. Bis er grün ist, nie die Regel aufweichen, ohne dass das in DECISIONS begründet ist.
- [ ] **Schritt 5:** Commit „R-246: check:docs mit Tests; Doku-Inkonsistenzen behoben“.

### Task 7: Hook warnt bei nicht gemergten Remote-Branches (R-247)

**Dateien:**
- Ändern: `.claude/hooks/session-start.sh`. Nach der Git-Zeile kommt ein Block, der `timeout 5 git ls-remote --heads origin` aufruft.
- Anlegen: `tests/unit/hook-branches.test.ts`

**Verhalten:**
- Für jede Ref außer HEAD des eigenen Branches gilt: Ist der SHA lokal unbekannt (`git cat-file -e`) oder nicht Vorfahre von HEAD (`git merge-base --is-ancestor`), wird er gesammelt.
- Ausgabe: `⚠️ Remote-Branches mit Stand, der nicht in HEAD enthalten ist: <name> (<sha7>), … → prüfen und ggf. mergen (D-016, R-247)`
- Schlägt `ls-remote` fehl oder läuft in den Timeout: `Hinweis: Remote-Branches nicht geprüft (kein Zugriff auf origin).`
- Gibt es kein `origin`: keine Zeile.

- [ ] **Schritt 1: Failing Test.** Vitest mit `execFileSync('git', …)` in einem temporären Verzeichnis. Ein Bare-Remote, ein Klon und Commits mit `-c user.name=t -c user.email=t@example.invalid`:
  - `warns about unmerged branch`: Branch `feature` mit einem Commit, den HEAD nicht kennt. Die Hook-Ausgabe enthält `feature (`.
  - `quiet for merged branch`: Branch `old`, Vorfahre von HEAD. Die Ausgabe enthält `old (` nicht.
  - `notice when origin unreachable`: `origin` zeigt auf einen nicht existierenden Pfad. Die Ausgabe enthält `nicht geprüft`, der Exit-Code ist 0.
  - Der Hook läuft mit `CLAUDE_PROJECT_DIR=<klon>` und ohne `docs/`. Er darf daran nicht scheitern.

- [ ] **Schritt 2:** FAIL. **Schritt 3:** Umsetzen.
- [ ] **Schritt 4:** Grün. Gegen das echte Repo zeigt der Hook den alten Branch `claude/pokelike-bot-extension-skalzp`. Das ist erwartet und Teil von R-244. `scripts/check-hook-budget.sh` ist grün.
- [ ] **Schritt 5:** Commit „R-247: Hook warnt vor nicht gemergten Remote-Branches, mit Test“.

### Task 8: Doku – API-Abgleich, CHANGELOG, Bundler (R-098, R-208, R-079)

**Dateien:** Anlegen `docs/USERSCRIPT_API.md` und `CHANGELOG.md`. Ändern `README.md` (Verweis), CLAUDE.md (Befehle `check:docs`, `check:userscript`).

- [ ] **Schritt 1: `docs/USERSCRIPT_API.md`.**
  - Inhalt: eine Tabelle je genutzter API (Spalten: Userscripts von quoid, Tampermonkey, Violentmonkey, `@grant` nötig?, Quelle mit URL und Abrufdatum) und eine Tabelle der Metadaten-Schlüssel.
  - Ergebnis „genutzt“ gegen `usedGmApis(dist/pokelike-bot.user.js)`, ausgeführt und notiert.
  - Weicht `NO_GRANT_NEEDED` von der README ab, wird T4 angepasst.
- [ ] **Schritt 2: `CHANGELOG.md`** nach Keep a Changelog: `## [Unreleased]` mit den P2-Änderungen und `## [0.1.0]` mit dem Stand aus dem Vorgänger.
- [ ] **Schritt 3:** `npm run check:docs` ist grün. Commit „R-098/R-208: USERSCRIPT_API.md (Abgleich quoid/TM/VM), CHANGELOG“.

### Task 9: Abschluss der Phase

- [ ] R-015 und R-016: Ist die Session nicht frisch gebaut, kommt ein D-Eintrag. Die Bestätigung erfolgt in der ersten frisch gebauten Session, der Tag wechselt auf `[P3]`, PLAN wird angepasst und `check:docs` ist grün.
- [ ] Die R-Zeilen von P2 mit Nachweis (Testname bzw. Prüfprotokoll) auf ✅ setzen, die Nachweise in R-103 ohne „Lücke“.
- [ ] Vollständiger Lauf: `npm run typecheck`, `npm run lint`, `npx prettier --check .`, `npm test`, `npm run build`, `npm run check:userscript`, `npm run check:docs`, `scripts/check-hook-budget.sh`, `npm run e2e`.
- [ ] Eigenes Review, dann superpowers:requesting-code-review (ein frischer Reviewer über alle P2-Änderungen). Danach das Review-Tor nach CLAUDE.md Regel 5 mit den drei Reviewer-Subagenten parallel. Funde beheben, PROGRESS aktualisieren, Phase auf P3 schalten.
