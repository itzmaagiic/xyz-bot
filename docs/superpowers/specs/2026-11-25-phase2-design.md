# Phase 2 – Gerüst und Build: Design

Stand 2026-11-25 · Freigabe nach CLAUDE.md (D-006) durch eigenes Review plus D-031 · Grundlage: `docs/PLAN.md` Phase 2, Bestandsaufnahme (`docs/superpowers/audits/`), HA §4 und §9.

## Absicht
Beide Build-Ziele existieren bereits (D-016). In Phase 2 wird daraus eine **verlässliche, geprüfte Pipeline**: Das Userscript hält sich exakt an HA §4 (iOS-Userscripts, Tampermonkey, Violentmonkey). Automatische Checks verhindern Rückfälle, etwa bei APIs, Metadaten, Import-Grenzen oder stillen Fehlern. Und jede Session findet ihre Werkzeuge vor (Doku-Check, Branch-Warnung).

## Ziele (R-IDs)
- Userscript nur mit der GM-Schnittmenge (`GM.getValue/setValue/deleteValue/listValues/addStyle/setClipboard/info`), alles andere per Feature-Erkennung. Fallback ist **localStorage mit Präfix `pkbot.`** (R-099, R-100, R-102).
- Metadaten nach HA §4: `@grant` automatisch aus der tatsächlichen Nutzung, `@updateURL`/`@downloadURL` auf GitHub raw. Die Bridge wird nicht minifiziert, Ziel ist ES2020 (R-103 bis R-105, R-107).
- Automatische Checks: GM-Schnittmenge im Bundle, Metadaten (R-192, R-193), Import-Grenzen `core/` und `ui/` gegen `platform/` (R-032), keine leeren bzw. stillen catch-Blöcke (R-199).
- Werkzeuge: `npm run check:docs` (R-246), Warnung des Hooks bei nicht gemergten Remote-Branches (R-247), CHANGELOG (R-208), D-Eintrag zum Bundler (R-079), API-Abgleich mit quoid/userscripts (R-098).
- E2E-Infrastruktur: Viewports nach UI.md §1, der Live-Test wertet Fehler-Pausen als Fehlschlag. R-033 und R-082 abnehmen.

## Nicht-Ziele
Keine Bot-Logik und keine UI-Gestaltung. Der Hänger bei Bosskämpfen ist P3. Kein Einchecken von `dist/`, das ist R-203 in P7.

## Anti-Ziele
- Ein Fallback, der den Manipulationsschutz des Spiels auslöst. Geprüft: `pk.storageDigest` erfasst nur `poke_*`-Schlüssel (GAME_RECON §12.9). Unser Präfix `pkbot.` liegt außerhalb und ist deshalb sicher. Spielschlüssel bleiben tabu (R-145).
- Checks, die nur pro forma grün sind, etwa ein catch-Block, der den Fehler „verwendet“, ohne ihn zu melden.

## Ansätze
1. **Checks als Code plus Lint-Regeln, gebaut auf dem Bestehenden (gewählt).**
   - Die reinen Funktionen für Metadaten und Grant-Ermittlung liegen in `scripts/userscript-meta.mjs` und sind mit Vitest getestet. `build.mjs` nutzt sie, `npm run check:userscript` prüft das gebaute Bundle.
   - Grenzen und catch-Regeln setzt ESLint über `no-restricted-syntax` und `no-restricted-imports` durch, ergänzt um einen Vitest-Grenztest.
   - Vorteil: Jede Session bekommt Fehler sofort im normalen Ablauf (`npm test`, `npm run lint`).
2. *Separates Prüfwerkzeug außerhalb von ESLint und Vitest:* doppelte Infrastruktur. Verworfen.
3. *Nur Review statt Automatik:* widerspricht R-192, R-193 und R-199 („automatisch“, „ESLint-Regel“). Verworfen.

## Design
- **T1 Userscript-Speicher:** `src/platform/userscript/storage.ts` mit `makeStorage(env)`. Die Umgebung wird injiziert (GM-Objekt, localStorage, Präfix), damit es testbar ist. `GM.getValue` und `setValue` nutzen JSON. Fehlt GM oder wirft es, kommt `localStorage` mit `pkbot.<key>` zum Einsatz, und schlägt auch das fehl, ein Map-Speicher. Jeder Fallback wird mit `noteError` vermerkt. ~~`onChange` gibt es nur, wenn `GM.addValueChangeListener` per Feature-Erkennung vorhanden ist, sonst ist es ein No-op.~~ → Das Userscript hat kein `onChange` (D-031). Das ist erlaubt, weil der Bot im Userscript nur einen Kontext hat. Die `GM_*`-Legacy-APIs entfallen.
- **T2 Build:**
  - `scripts/userscript-meta.mjs` exportiert `ALLOWED_GM`, `usedGmApis(bundleText)`, `buildMeta({version, grants, repo})` und `checkUserscript(bundleText, metaText)`, die eine Fehlerliste liefert.
  - `build.mjs` erzeugt `@grant` aus `usedGmApis`, minifiziert die Bridge nicht mehr und setzt `target: ['es2020']`.
  - `@updateURL` ist `https://raw.githubusercontent.com/itzmaagiic/xyz-bot/main/dist/pokelike-bot.meta.js`, `@downloadURL` die entsprechende `.user.js`.
  - `npm run check:userscript` baut und prüft. Er ist in `npm test` eingebunden über einen Vitest-Test, der das gebaute Bundle prüft, wenn `dist/` existiert, sonst baut er im Test per esbuild-API.
- **T3 Fehler und Grenzen:**
  - `src/core/log/note.ts` mit `noteError(where, err)`: ein Ringpuffer mit 50 Einträgen, `recentErrors()` und `console.debug`.
  - ESLint verbietet in `src/**`, dass ein `CatchClause` ohne `noteError(...)`- bzw. `throw`-Aufruf auskommt, außerdem `.catch(() => …)` ohne Parameter.
  - `src/core/**` und `src/ui/**` dürfen nicht aus `platform/chrome|userscript` importieren und die Globals `chrome` und `GM` nicht nutzen.
  - Alle bestehenden catch-Stellen werden angepasst.
- **T4 Werkzeuge:**
  - `scripts/check-docs.mjs` prüft: IDs lückenlos und eindeutig, „Nächste freie ID“, Tags gegen PLAN, Verweise auf R- und D-IDs, ✅-Zeilen ohne „**Lücke:**“.
  - Hook: `git ls-remote` mit Timeout von 5 s. Warnung, wenn ein Remote-Branch auf einen Commit zeigt, der nicht in HEAD enthalten ist. Ohne Netz gibt es eine stille Notiz. Testskript mit temporärem Remote.
  - `CHANGELOG.md` nach Keep a Changelog, D-Eintrag zu esbuild, `docs/USERSCRIPT_API.md` (Abgleich mit der README von quoid/userscripts, TM- und VM-Doku).
- **T5 E2E:**
  - `playwright.config.ts` mit Projekten nach UI.md §1: `userscript-iphone` (390×844), `userscript-iphone-safari` (390×664), `userscript-iphone-se`, Desktop 1440×900.
  - `live.spec.ts` schlägt fehl, wenn der Bot mit „keeps failing“, „internal error“ oder „blocked“ pausiert.
- **R-015 und R-016** lassen sich nur in einer frisch gebauten Session bestätigen. Gelingt das in P2 nicht, wird es mit D-Eintrag verschoben.

## Dem Umsetzer überlassen
Die genaue esquery-Syntax, die Namen der Testfälle und die Form der Ausgabe von `check-docs`.
