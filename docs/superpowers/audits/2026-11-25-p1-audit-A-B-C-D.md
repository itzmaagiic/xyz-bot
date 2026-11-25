# Bestandsaufnahme Phase 1: Abschnitte A, B, C und D (Ziel, Spielwissen, Aufklärung, Architektur)
requirements-reviewer, Stand nach Live-Lauf 2, 2026-11-25. Prüfprotokoll: `npx tsc --noEmit` 0 Fehler, `npx eslint .` Exit 0, `npx vitest run` 111/111, Scan der Fixtures, Skripte und Docs auf Token, E-Mail und UUID: 0 Treffer. Playwright und Netzwerk sind laut Auftrag nicht ausgeführt. Vorschlag: 13 ✅, 56 🟡, 7 ❌.

| R-ID | Vorschlag | Nachweis bzw. Fundstelle | Lücke |
|---|---|---|---|
| R-028 | 🟡 | Hauptschleife `bot.ts:181-203`, Auto-Neustart `bot.ts:394-404`. Live 2: 4 Runs autonom inklusive Neustart | Reproduzierbarer Hänger am Kampfende (§12.8), kein Run-Log unter `runs/` |
| R-029 | 🟡 | `actionDelayMs`, Spieleinstellungs-Vorschläge `bot.ts:123`, Kampf-Skip `engine.ts:183-184` | Ø Dauer pro Run nicht gemessen |
| R-030 | 🟡 | Kein `Math.random` in Strategie und Simulator, `sim-seed.test.ts` | Kein Test „gleicher Zustand → gleiche Entscheidung“ für `decide()` |
| R-031 | 🟡 | Einzelne Faktortests in `strategy.test.ts` | Kein Faktor-Inventar. Items, Traits und Relikte ohne Einflusstest |
| R-014 | ✅ | `git ls-files` gefiltert: 0 Treffer | – |
| R-032 | 🟡 | Kein `chrome.`/`GM.` in `src/core` und `src/ui` (grep) | Kein automatischer Check der Import-Grenzen |
| R-033 | 🟡 | `scripts/build.mjs:153-174` (MV3), `extension.spec.ts:8-10` | E2E nicht selbst ausgeführt |
| R-034 | 🟡 | `build.mjs:178-210`: genau eine `.user.js` plus `.meta.js` | Eignung für iOS unbelegt: Legacy-Grants `GM_*` im Metadaten-Block |
| R-035 | 🟡 | Feature-Erkennung (`userscript/main.ts:18-58`), GM-Shim-E2E | Kein API-Abgleich mit Tampermonkey und Violentmonkey (R-098) |
| R-036 | 🟡 | GAME_RECON §10.1 | Ohne Datum und Version je Zeile. Es fehlen: Tower-Start mit freigeschalteten Pokémon, Stage Select, Champion-Knöpfe, Sonderbonbon, Pokésort |
| R-037 | 🟡 | `engine.ts:180-186`, Test „battle → skip“ | Klickt das ausgegraute SKIP immer wieder (§12.8) |
| R-038 | 🟡 | Regionswahl, „gesperrt → Pause“ (`engine.test`) | Live 2: höchstens 3 Orden, 0 Siege. Champion-Sieg nur in STRATEGY.md |
| R-039 | 🟡 | Nuzlocke-Umschaltung, Risikogewichte `map.ts:60-62` | Regeln fehlen (R-062) |
| R-040 | 🟡 | `tower-select` erkannt, `engine.ts:121-131, 307-317` | Normal/Hardcore wird nie gewählt, `stat-buff` pausiert, Fixtures fehlen |
| R-041 | 🟡 | `challenge.test.ts` | Augments fehlen, Daily/Weekly nicht live geprüft, keine Meldung „nicht unterstützt“ |
| R-042 | 🟡 | `#btn-multiplayer` wird nie geklickt | Keine Meldung, kein Test |
| R-043 | 🟡 | `engine.ts:88-322`. Live 2: Titel → Region → Starter → Karte → 3 Orden | Kein Run bis Top 4 oder Champ, Hänger am Kampfende |
| R-044 | 🟡 | `map.ts:42-69` bewertet 13 Typen | Unbekannter Typ ergibt Wert 2 (`map.ts:70-71`), der Bot rät. `poke_mart` und `legendary` nie gesehen |
| R-045 | 🟡 | `detector.test` catch-en/-de, `engine.test` „catch with room“ | „Überspringen“ ohne Engine-Test |
| R-046 | 🟡 | `detector.test` item, `engine.test` „takes Expert Belt“ | `#btn-skip-item` ohne Test |
| R-047 | ✅ | `chal-relic-0` → passive, `challenge.test` Relikt-Wahl und -Tausch | Neues Relikt wird über Inline-Style erkannt (`engine.ts:260`), das ist fragil |
| R-048 | ✅ | `detector.test` swap-de, `engine.test` „swap → …“, `strategy.test` „releases the weakest or keeps“ | Fixture nur auf Deutsch |
| R-049 | 🟡 | `detector.test` trade, `engine.test` Trade | Annehmen nur per Flag, `#btn-trade-continue` ohne Test |
| R-050 | ✅ | `detector.test` badge, `engine.test` „badge → next map“, Live 2: 3 Orden | – |
| R-051 | 🟡 | `elite-prep` erkannt, `engine.test` „elite prep → fight“, Shift+Ziffer | Drag & Drop geht nicht (`setPointerCapture`), Weg ohne Test (R-231) |
| R-052 | 🟡 | `gameover` erkannt, `engine.test`, Live 2: 2× | „Play Again“ nie genutzt. Nach verlorenem Arenakampf kein Game Over (§12.8) |
| R-053 | 🟡 | `engine.ts:250-255`, Guard sperrt `shareRun` | Kein `win`-Fixture, kein Test |
| R-054 | 🟡 | `engine.test` „evolution overlay → Skip“ | Nur synthetisch, `eevee-choice` ohne Test |
| R-055 | ❌ | `shop-modal` wird zu `unknown-modal`, also Pause | Nicht behandelt, nicht aufgeklärt |
| R-056 | 🟡 | `engine.ts:90-101` | Kein Test. „Runs fortsetzen“ ist standardmäßig an (R-214) |
| R-057 | 🟡 | `trainer`, starter-en/-de, Starterwahl im `engine.test` | Charakterwahl ohne Test |
| R-058 | 🟡 | §8/§10.1, `strategy.test` „fainted last, best matchup leads“ | Nicht live beobachtet |
| R-059 | 🟡 | §12.2, `items.ts:89-91` | Bewertung ohne Typwechsel, kein Test |
| R-060 | 🟡 | §12.3, §11, die Simulation nutzt `computeTraitTiers` | Keine Unit-Tests mit konkreten Teams |
| R-061 | 🟡 | §8, Wiederbelebung nur per Sacred Ash | Kein Test |
| R-062 | ❌ | §12.4 offen | Keine Regeln, keine Tests |
| R-063 | 🟡 | Vitamin-Punkte bei der PC-Starterwahl (`challenge.ts:9, 36`) | Keine EV-Planung |
| R-064 | 🟡 | GAME_RECON §11 | Tower-Unterseiten und `/challenges/` nicht ausgewertet |
| R-065 | ✅ | Prüfprotokoll R-065 und D-026, `webkit-2359` mit `DEPENDENCIES_VALIDATED` | GAME_RECON §10.4 veraltet |
| R-066 | 🟡 | Live 1 und 2, §4, §9, §12.8 | Ohne Fixture: `win`, `stat-buff`, `endless-stage-complete`, `transition`, Shop, Kampfende bei Niederlage |
| R-067 | ✅ | §1, §12.1 (`read-game.mjs`, 2026-11-25, v3.8) | §1 nennt „~2100“, §12.1 „1813“ Funktionen |
| R-068 | ✅ | §12.1: Header-CSP, keine Meta-CSP, Script-Element läuft | §10.7 Frage 1 nicht abgehakt |
| R-069 | ✅ | §1, §12.1 (IndexedDB `[]`), §12.6 `saveRun`, §10.3 | Verweis in §12.6 falsch |
| R-070 | 🟡 | §4: alle 20 Screen-IDs mit Merkmal und Selektor, `SCREEN_IDS`, Fixture-Test für 16 von 20 | `transition`, `win`, `stat-buff`, `endless-stage-complete` ohne Fixture. Kampfende/Niederlage nicht dokumentiert |
| R-071 | ✅ | §6: `state.team`, `getBestMove`, `heldItem`, `state.items` | DOM-Fallback nicht beschrieben |
| R-072 | ✅ | §6: `state.map`, `currentNode`/`currentNodeId`, `g.map-node[data-node-id]` | Liste der Knotentypen unvollständig |
| R-073 | 🟡 | §3, §12.1 Standardwerte | Wirkung je Einstellung nicht geprüft |
| R-075 | 🟡 | 29 Fixtures, 16 von 20 Screens plus `challenge-select` und `weekly-select`. Scan: 0 Treffer | Es fehlen 4 Screens, Kampfende/Niederlage, echte Modals. DE/EN nur für catch und starter |
| R-076 | 🟡 | GAME_RECON §1–§12 | Offene Fragen verstreut, Kopf veraltet, `read-game.json` nicht eingecheckt |
| R-077 | 🟡 | Version gelesen in `page-bridge.ts:145-148` und `reader.ts:27-29` | Nicht in Logs und Live-Ergebnis gespeichert, kein Test |
| R-012 | 🟡 | `bot.ts:117-121, 502-503, 128-131` | Kein Test |
| R-078 | ✅ | `tsconfig.json` strict plus `noUncheckedIndexedAccess`, `tsc` 0 Fehler | – |
| R-079 | 🟡 | esbuild (`scripts/build.mjs:3`) | Kein D-Eintrag |
| R-080 | ✅ | `eslint.config.js`, `.prettierrc.json`, `eslint .` Exit 0 | – |
| R-081 | ✅ | `vitest run` 111/111 | – |
| R-082 | 🟡 | `playwright.config.ts`, `tests/e2e/*` | Live-Spec wertet Hänger als bestanden |
| R-083 | 🟡 | `reader.ts:16-37` | Kein Test „schreibt nicht in DOM oder Storage“ |
| R-084 | 🟡 | `detector.ts:137-144` | Kein Zustandsautomat, kein Zustand für das Kampfende |
| R-010 | 🟡 | `detector.test` „unknown screen id“, „two active screens“, `engine.test` „unknown modal → pause“ | Kein Snapshot. Ausgegrautes SKIP gilt nicht als unerwartet |
| R-085 | 🟡 | Reine Funktionen mit Tests | `engine.decide` liest DOM und ändert `mem` |
| R-086 | 🟡 | `actor.ts:64-133` Pointer- und Maus-Events | **Keine Touch-Events**, `pointerType` fest auf `'mouse'` |
| R-087 | 🟡 | `bot.ts:467-510`: Wirkungsprüfung, 3 Versuche, Backoff, Pause | Prüft nicht, ob das Ziel aktiv ist (`isShown` ohne `disabled`), daher der sinnlose Klick. Reorder und Swap ohne Backoff, kein Test |
| R-088 | 🟡 | `typechart.ts`, die Tabelle des Spiels hat Vorrang, `strategy.test` „type chart“ | Test nur mit künstlicher Tabelle, Fallback ohne Quelle |
| R-089 | 🟡 | `baseStats`, `__POKEDEX__` (`page-bridge.ts:180-194`), `pkrl_poke_*` | `__POKEDEX__` ohne Test, kein gebündelter Fallback |
| R-090 | 🟡 | `simulator.ts:82-113`, `endlessState` | Top 4 für Gen 2 und Gen 6 fehlen, Tower-Gegner nicht als Daten |
| R-006 | ❌ | `logger.ts:4-9`: nur `{t, level, msg, data}` | Kein D-005-Format, kein Export, `runs/` fehlt |
| R-091 | 🟡 | Ringpuffer mit 500 Einträgen, Statistik | Kein Test |
| R-092 | 🟡 | `src/ui/overlay.ts` über `app.ts` | Nur E2E |
| R-093 | 🟡 | `platform/types.ts:16-25`, `content.ts`, `userscript/main.ts` | Keine Adapter-Tests, kein localStorage-Fallback |
| R-094 | ❌ | Kein MutationObserver | Polling mit festen Sleeps, keine Prüfung „Buttons aktiv“ |
| R-095 | ❌ | Kein Watchdog | – |
| R-096 | ❌ | Kein `visibilitychange`/`pagehide` | – |
| R-097 | ❌ | Kein `wakeLock` | – |
| R-224 | 🟡 | `stat-buff` und unbekannte Modals pausieren | Für `win`, `stage-complete` und Evolution gibt es Logik ohne Fixture. Am Kampfende rät der Bot. `map.ts:70-71` |
| R-027 | 🟡 | GAME_RECON §1–§12 mit Quelle, Datum und Version | Offene Fragen nicht zusammengeführt, Widersprüche |

**Auffälligkeiten**
1. **Ursache des Hängers (§12.8):** `engine.ts:183` klickt `#btn-auto-battle`, solange `isShown()` wahr ist (`detector.ts:59-76`). `disabled` und `aria-disabled` werden nie geprüft. Es gibt keinen MutationObserver, keinen Watchdog, keine Touch-Events und kein `visibilitychange`. Das Overlay verdeckt links über die volle Höhe die Teamspalte (R-002, `artifacts/live/live-run.png`).
2. 16 von 20 Bildschirmen haben einen Fixture-Test. Für `win` und `stage-complete` gibt es Logik ohne Fixture, das widerspricht R-224.
3. Widersprüche in GAME_RECON: Funktionszahl, §10.4 veraltet, §10.7 Frage 1 nicht abgehakt, falscher Verweis in §12.6, Reihenfolge §11/§12.
4. Live 2: Laut Overlay 4 Runs mit 0 Siegen und 4 Niederlagen. PROGRESS schreibt „2 Game Over“ (Bildschirm-Stichproben). Das Bot-Log ist einzeilig und vom Ringpuffer abgeschnitten.
