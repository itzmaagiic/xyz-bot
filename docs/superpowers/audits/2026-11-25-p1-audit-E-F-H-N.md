# Bestandsaufnahme Phase 1: Abschnitte E, F, H und N (Userscript, Chrome, Fair Play, Vorgänger)
requirements-reviewer, Stand `5dc9c76`, 2026-11-25. Prüfprotokoll: `npx vitest run` 109/109, Playwright mit 3 Projekten 17 bestanden und 1 gewollt übersprungen. `git grep` nach Tokens und Personendaten: 0. Vorschlag: 5 ✅, 25 🟡, 3 ❌.

| R-ID | Vorschlag | Nachweis bzw. Fundstelle | Lücke |
|---|---|---|---|
| R-098 | ❌ | Kein Abgleich mit der README von quoid in den Docs | Abgleich fehlt |
| R-099 | 🟡 | `GM.getValue`/`setValue`/`setClipboard` (`userscript/main.ts:24,41,80`). Dazu `GM_getValue`, `GM_setValue`, `GM_setClipboard` und `GM_addValueChangeListener` (main.ts:28-29, 42, 49-53, 84-85) | Diese Legacy-APIs liegen außerhalb der Schnittmenge. Kein Check (R-192) |
| R-100 | 🟡 | Feature-Erkennung per `typeof` (main.ts:24, 28, 41, 42, 49, 80, 84), Speicher-Map bzw. `copyViaDom` | Fallbacks ungetestet (der Shim kennt nur `GM.*`), Fehler werden still geschluckt |
| R-101 | 🟡 | `notify()` liefert `false` (main.ts:93-95), dann Toast (`app.ts:34-37`) | **Kein Ton.** Toast über `notify` ungetestet |
| R-102 | ❌ | Der Fallback ist eine Map im Speicher (main.ts:19-20, 35, 46) | Kein localStorage mit Präfix, Einstellungen gehen beim Neuladen verloren |
| R-103 | ✅ | Prüfprotokoll `dist/pokelike-bot.meta.js` (`build.mjs:189-206`): `@name`, `@namespace`, `@version 0.1.0`, `@description`, 2× `@match`, `@run-at document-idle`, `@inject-into content`, `@noframes` | Automatischer Check fehlt (R-193) |
| R-104 | 🟡 | `@grant` fest in `build.mjs:198-204`, heute deckungsgleich mit der Nutzung | Kein automatischer Abgleich, `GM_*`-Grants außerhalb der Schnittmenge |
| R-105 | ❌ | Kein `@updateURL`/`@downloadURL` (`build.mjs:189-206`) | `dist/` ist gitignored |
| R-106 | 🟡 | script-Element plus `READY_ATTR` (main.ts:62-73), DOM-Fallback (`app.ts:30, 40`). In Chromium belegt (`userscript.spec.ts:6, 37`) | DOM-Fallback ungetestet. In WebKit läuft der Test in der Main-World |
| R-107 | 🟡 | Kein `@require`, eine Datei, IIFE (`build.mjs:21`) | Die Bridge ist **minifiziert** eingebettet (`build.mjs:28`). `target` ist `safari15` statt es2020, das Bundle enthält `??=` (ES2021). iOS 15 nicht getestet |
| R-108 | 🟡 | `window.__pkbotApp` (`app.ts:25-26`), `page-bridge.ts:238` | Wirkt nur pro JS-Welt, Erweiterung und Userscript ergeben 2 Bots. Kein Test |
| R-109 | 🟡 | Einstellungen und Statistik gespeichert (`bot.ts:80-86, 399`) | Laufstatus wird nicht übernommen, keine SPA-Behandlung, kein Test |
| R-110 | 🟡 | `popup.ts:17-39`, `popup.html:14-36` | Getestet ist nur „kein Spiel“ |
| R-111 | ✅ | `options.ts`/`options.html`, Test `extension.spec.ts:76` „options page shares settings with the overlay“ grün | – |
| R-112 | 🟡 | `options.ts:26-31`, `bot.ts:83-86`. Test belegt nur Options → Overlay | Overlay → Options und Popup fehlen |
| R-113 | 🟡 | `background.ts:23`, `content.ts:27-35`, Toast-Fallback (`app.ts:36`) | Kein Test |
| R-114 | 🟡 | `commands` (`build.mjs:168-172`), `background.ts:13` | Kein Test |
| R-115 | ✅ | `world: "MAIN"` (`build.mjs:165`), `bridge-main.ts:4`. Test `extension.spec.ts:55` grün | `:23` prüft `state` nicht |
| R-013 | 🟡 | `humanDelay` ±40 % (`actor.ts:9-11`), `actionDelayMs` 150–5000 ms (`settings.ts`), alle Eingaben über den Actor | Kein Test |
| R-145 | 🟡 | Kein `localStorage.setItem`, kein fetch/XHR-Patch in `src` | Check fehlt. Die Simulation ruft `fetchPokemonById`/`fetchSpeciesForLevel` des Spiels auf (`simulator.ts:185, 417, 660, 751`), vermutlich Cache-Schreibzugriffe und Netzwerk |
| R-146 | 🟡 | Kein Netzwerkcode in `src` | Kein Test. Fetch-Aufrufe der Simulation siehe R-145 |
| R-147 | 🟡 | `guard.ts`, `actor.ts:65, 72, 94, 117`, `bot.ts:192-195`, `guard.test.ts` | Erlaubnis per Einstellung (R-165) fehlt. „Löschen“ nicht konkretisiert. Zwischenziele beim Drag ungeprüft. Ergänzt am 2026-11-25: Teilen, Shop, Vitamine, App-Installation und alle `confirmResetRun`-Knöpfe gesperrt |
| R-148 | 🟡 | Kein Zugriff auf Token- oder Konto-Schlüssel | Kein Bereinigungsschritt. `logger.ts:48-55` exportiert `data` ungefiltert |
| R-233 | 🟡 | README (Edge, Brave, Opera), `minimum_chrome_version 111` | Lauf in Edge, Opera und Brave nicht belegt |
| R-234 | 🟡 | `challenge.ts`, `engine.ts:142-161`, `challenge.test.ts` | Augments fehlen. Daily und Weekly nicht live geprüft |
| R-235 | 🟡 | `settings.ts:15`, `settings-form.ts:96-126`, Test „picks the strongest copy…“ | `#pk-chalstarter` ungetestet |
| R-236 | 🟡 | Relikte über `PASSIVE_ITEM_POOL` (`simulator.ts:919-1000`) | Itemwerte fest im Code. Der Relikt-Test mockt die Simulation |
| R-237 | 🟡 | Kein Kaufpfad: `stat-buff` und `shop-modal` führen zur Pause | Bis 2026-11-25 keine harte Sperre. Jetzt sperrt der Guard `#btn-mart-nav`, `openShopModal` und `buyVitamin`. Budget und Test der Pause fehlen |
| R-238 | 🟡 | Whitelist (`page-bridge.ts:161-170`, `protocol.ts:33-41`), UI-Öffner (`:197-203`), zweistufig (`extension.spec.ts:55`) | `applyDarkMode()` steht nicht in D-018. Kein Check gegen weitere Spielfunktionen |
| R-239 | 🟡 | Teil 1 per `sim-seed.test.ts`. Wiederherstellung in `simulator.ts:353-362` | Kein Test der Wiederherstellung. `restored` wertet der Bot nicht aus. **Neuer Fund: `await` unter dem Simulations-Seed** (siehe R-249) |
| R-240 | ✅ | `.gitignore:10-11`, `git check-ignore`, `git ls-files` ohne private Stände | – |
| R-241 | 🟡 | Kein `reload` und kein `location.` in `src` | Kein Guard, kein Test |
| R-242 | ✅ | `detector.ts:7-29` nur über IDs und Klassen, kein `textContent`. `detector.test.ts` mit EN- und DE-Paaren grün | Deutsche Fixtures nur für 3 Bildschirme |

**Auffälligkeiten**
1. **Echter Spiel-Zufall während der Simulation:** `simulator.ts:479→482` und `:816→830` rufen `await trainerEnemies` bzw. `await wildEnemy` auf, nachdem `seedRng(...)` gesetzt ist. Während des Wartens kann Spielcode mit dem Seed des Bots laufen, und `finally` spult den echten RNG danach zurück. Das ist jetzt R-249.
2. Userscript-Metadaten weichen vom HA §4 ab: `@updateURL`/`@downloadURL` fehlen, `GM_*`-Grants, die Bridge ist minifiziert, kein localStorage-Fallback.
3. Der Schutz gegen doppelten Start wirkt nicht über JS-Welten hinweg. Nötig ist ein Kennzeichen im DOM (R-108, R-229).
4. Fair Play hat außer dem Reset-, Tasten- und Shop-Guard keinen automatischen Check (R-145, R-146, R-237, R-238, R-241).
5. Lücken im Guard (Teilen, Shop, App-Installation, zweiter Reset-Knopf) sind am 2026-11-25 geschlossen (`guard.test.ts`).
