# Fortschritt

**Stand:** 2026-11-27
**Aktuelle Phase:** P3
_(Phase 0, 1 und 2 sind abgeschlossen, alle Review-Tore bestanden. Jetzt kommt Phase 3: Kern, Zustand, Bildschirme, Aktionen, Logs und Baseline-Run, siehe `docs/PLAN.md`.)_

## In Arbeit
- **P3c „Not-Aus, unerwartete Fehler, Speicherprobleme“ (D-039): umgesetzt, Gesamt-Review bestanden.**
  - Review „mit Korrekturen“: 0 kritische und 2 wichtige Funde (Schritt plus Start handelte doppelt, eine Nutzerpause wurde zu `failing`), dazu 4 hochgestufte kleine Funde, alle behoben. Die restlichen kleinen Funde stehen unter „Vorbefunde aus dem Gesamt-Review P3c“.
  - Not-Aus (R-011), globale Fehler-Handler (R-200) und Speicherhinweise (R-259) sind mit Unit- und E2E-Tests belegt, die E2E-Tests zusätzlich mit Mutationsproben.
  - 439 Unit-Tests, 52 E2E-Tests bestanden, 3 gewollt übersprungen.
  - Spec `docs/superpowers/specs/2026-11-27-p3c-not-aus-fehler-speicher-design.md`, Plan `docs/superpowers/plans/2026-11-27-p3c-not-aus-fehler-speicher.md`.
- **P3a** (Kämpfe ohne Hänger, D-037) und **P3b** (Run-Logs, Live-Urteil, MAIN-Welt-Fehler, D-038) sind abgeschlossen, live belegt und haben ihren Gesamt-Review bestanden (siehe „Erledigt“). 411 Unit-Tests grün, 44 E2E-Tests bestanden, 3 gewollt übersprungen.

## Nächster Schritt
1. **Phase 3 (Kern und Baseline-Run), weitere Inkremente in dieser Reihenfolge:**
   - ~~Hänger bei langen Bosskämpfen (P3a)~~ und ~~Run-Logs, Live-Urteil, MAIN-Welt-Fehler (P3b)~~ sind erledigt (D-037, D-038).
   - **P3c (in Arbeit, D-039):** Not-Aus (R-011), Laufzeit-Handler für `unhandledrejection`/`error` (R-200, deckt die Lint-Lücken aus D-036), Speicherfehler sichtbar machen (R-259).
   - **P3d:** Neuladen mit Laufstatus und Run-Logs (R-109), doppelte Ausführung und Tab-Sperre (R-108, R-229), Eingriff des Nutzers (R-213), fremder Run nur nach Bestätigung (R-214).
   - Aufklärung der Restbildschirme (D-029, R-224).
   - In der ersten **frisch gebauten** Session R-015 und R-016 bestätigen (D-034).
2. Die Vorbefunde der Reviewer für P3 bis P5 stehen unten und in `docs/superpowers/audits/2026-11-26-p2-gate-ui-strategy.md`.

## Entscheidungen (Nutzer hat delegiert, D-023)
- **Pokédollar:** Die strenge Regel bleibt, Ausgaben nur mit Freigabe, Budget-Standard 0. **Erledigt.**
- **Git-Verlauf bereinigt** (nach ausdrücklicher Freigabe, D-024). In `main` und im Session-Branch gibt es keine private Mailadresse und keinen Spielstand mehr. **Erledigt.**
- **Alten Branch `claude/pokelike-bot-extension-skalzp` löschen: Das muss der Nutzer tun.** Der Git-Proxy der Session lehnt das Löschen mit 403 ab. Der Branch enthält noch den alten Initial-Commit mit der privaten Adresse. Weg: im Browser, nicht in der GitHub-App, `github.com/itzmaagiic/xyz-bot/branches` öffnen und beim Branch das Papierkorb-Symbol wählen (iPhone: „Desktop-Website anfordern“). Laut GitHub-API ist der Branch nicht geschützt und hat keinen offenen PR. Der Nutzer löscht ihn später (Stand 2026-11-25). **Jede Session prüft zu Beginn mit `git ls-remote origin`, ob er noch existiert, und erinnert den Nutzer vor einer Veröffentlichung daran.** Seit P2 Task 7 meldet der SessionStart-Hook das automatisch („ℹ️ Bekannte Remote-Branches, nicht mergen“, Liste in `.claude/hooks/branches-handled.txt`). Ist der Branch gelöscht, verschwindet die Zeile; dann den Eintrag in der Liste entfernen. Ist er weg, R-244 auf ✅ setzen.

## Vorbefunde der Reviewer für spätere Phasen (Review-Tor P0, Runde 3)
**strategy-reviewer** (für P0 nicht anwendbar, weil `runs/` fehlt):
1. **Fair Play, Pflicht in P1/P4:** Simulations-Seeds werden aus dem echten Seed abgeleitet (`simulator.ts:339, 473, 522, 809`: `seedRng((getRngSeed() ^ …) >>> 0)`), `chainRate` (`:519`) nutzt den laufenden RNG-Zustand. Das verletzt R-239 bzw. R-248. Lösung: eigener PRNG plus Test. `STRATEGY.md:12` widerspricht dem Code.
2. **Taste R:** `actor.ts:85 pressKey` hat keine Allowlist. Heute wird es nur mit Shift+Digit1–6 aufgerufen (`bot.ts:442, 522`). Ein Guard und der Test nach R-147 fehlen, ebenso die Einstellung R-165.
3. **Pokédollar:** Es gibt keinen Ausgabepfad, aber auch keine harte Sperre. Ein Guard ist Pflicht, bevor R-136 und R-137 kommen (R-237).
4. **Logs:** `logger.ts` ist ein Ringpuffer mit 500 Einträgen, er loggt nur `why` plus Klickziel. Es fehlen `state`, `options`, `scores`, `confidence` und `outcome`, ebenso der Export nach D-005. Damit ist kein Strategie-Review möglich (R-006, R-116).
5. Es gibt keine Profile Sicher, Ausgewogen und Aggressiv (R-139). „FIGHT!“ wird auch bei 8 % Siegchance geklickt, ohne vorher Beutel, Ash oder Items zu prüfen (`engine.ts:232, 240`).
6. Nuzlocke ist kaum modelliert: ein Fang pro Zone, Permadeath beim Freilassen und vorsichtige Pfade fehlen (R-062, R-127).
7. Haupttodesursache sind Abnutzung und Trainer (STRATEGY.md). Pokécenter und Ash-Heuristik in P4 prüfen. Die bisherigen Messwerte beruhen auf kleinen Stichproben (8 bis 12 Runs) und sind nicht nach D-005 geloggt.

**ui-reviewer** (für P0 nicht anwendbar, weil es keine Screenshots und keinen Screenshot-Befehl gibt):
1. `playwright.config.ts` nutzt nur das iPhone 13 mit 390×664. Es fehlen `desktop` 1440×900, `iphone` 390×844 und `iphone-se`.
2. Es gibt kein Screenshot-Skript für alle Zustände und Spielbildschirme im hellen und dunklen Modus (R-180). Ein Befehl in CLAUDE.md fehlt.
3. **Verdeckung (R-002):** Das Panel liegt `fixed` links unten, ist bis 330 px breit (auf dem iPhone 330 von 390 px) und bis zu `100vh − 24px` hoch. Es verdeckt sehr wahrscheinlich Spielbuttons und das Run-Menü. Ein Test fehlt.
4. Es gibt keine Pille, kein Andocken und keine gespeicherte oder begrenzte Position (R-154 bis R-156).
5. Schrift 13 px bzw. 11 px, Buttons 32 px, Selects 30 px, Abstände außerhalb des Rasters, kein `env(safe-area-inset-*)`, `100vh` auf iOS (R-003, R-004, UI.md §3a).
6. Es fehlen Stopp, Team-Zustand, Fortschritt, nächster Boss, Tabs für Statistik und Log mit Filter sowie ein eigener Fehlerzustand. Der Hinweis auf Tastenkürzel ist auf iOS nutzlos.
7. Die Texte sind fest auf Deutsch, kein i18n (R-174). Hell und dunkel folgen `prefers-color-scheme` statt `darkMode` des Spiels (R-218).
8. Design-System (UI.md §6) und Mockups fehlen (R-177, R-179).

**strategy-reviewer, Review-Tor P1** (für P1 nicht anwendbar, Vorbefunde für P4, Belege in `artifacts/live/console.txt`):
14. **Sacred Ash verschwendet:** Der Bot setzt sie ein, obwohl die Route noch ein Pokécenter vor dem Boss hat (`items.ts:29-33`, gespart wird erst ab Karte 7 laut `engine.ts:557`). Regel: behalten, solange vor dem nächsten riskanten Kampf ein Pokécenter auf dem Pfad liegt (R-223).
15. **Boss ohne Heilung, obwohl der Konter besiegt ist:** Die Routenwahl entscheidet nur nach der Erfolgsquote, ohne Sicherheitsmarge (`sim-route.ts:127-134`, R-124).
16. **Systematisch zu optimistische Prognosen (Winner's Curse):** Der Bot nimmt das Maximum über bis zu 36 Routen mit je 26 bis 30 Simulationen. Danach sinkt der Wert fast immer, etwa 62 → 29 → 17 % oder 27 → 14 → 3 → 0 %. Lösung: beste Kandidaten nachsimulieren, nach Untergrenze ranken, Prognose und Ausgang zur Kalibrierung loggen (R-250).
17. **Keine Notbremse:** Bei ≥ 50 % besiegten Pokémon geht der Bot trotzdem in weitere Kämpfe (R-251).
18. **Kampfreihenfolge bei gesättigter Simulation:** Bei 100 % wird nicht umgestellt (`engine.ts:216-217` verlangt +4 %). Lösung: bei Gleichstand nach Überlebenden bzw. Rest-KP umstellen (R-133, R-135).
19. **Fang gegen den nächsten Boss:** Ponyta (Feuer) vor Misty (Wasser), unsicher, weil die Fangoptionen nicht geloggt sind (R-125).
20. **Log-Anforderungen für P3 (D-005):** vollständige `options`, `scores` je Faktor mit Simulationszahl und Konfidenz, `state` mit KP, Revives und Boss-Vorschau, `outcome` je Kampf neben der Prognose, Pausen mit Signatur und Button-Zustand, `summary.json` mit Todesursache. Keine veralteten Entscheidungstexte.

**ui-reviewer, Review-Tor P1** (für P1 nicht anwendbar, neue Vorbefunde für P5, gemessen an `artifacts/live/live-run.png`):
9. **Verdeckung gemessen:** Das Panel liegt bei x 12–341 und y 12–887, das sind 97 % der Höhe. Es verdeckt ≈29 % jeder Team-Karte, darunter die **KP-Zahlen des Spielers vollständig**. In R-002 auch `#btn-continue-battle` und das Ziehen in „Choose Your Order“ prüfen.
10. Der Fehlerzustand ist nicht unterscheidbar: Er sieht aus wie eine Pause, der Text ist englisch und enthält einen Selektor, es gibt keinen nächsten Schritt, und die „Entscheidung“ ist veraltet.
11. Inhalt läuft waagrecht über, die Pfeile der Select-Felder sind abgeschnitten, die Tastenzeile ist unten abgeschnitten.
12. Die Einstellungen sind standardmäßig aufgeklappt und belegen ≈48 % des Panels.
13. Sprachen gemischt (Deutsch und Englisch), interne Optionsnamen im Hinweis. Der Live-Viewport ist 1280 statt 1440 breit.

## Vorbefunde aus dem Gesamt-Review P3c (2026-11-27, zurückgestellt)
1. **Fehler in einer Schleife:** `reportUnexpected` schreibt jedes Auftreten ins Overlay-Log (500 Zeilen), das verdrängt alles andere. Fix: Wiederholungen zusammenfassen („×n“). Das Run-Log zählt ohnehin jedes Auftreten.
2. **Optionsseite:**
   - Der 1,5-s-Timer kann eine spätere Fehlermeldung löschen.
   - Wirft `chrome.storage.local.set` synchron, bekommt `reportSave` das nicht mit.
   - „Statistik zurückgesetzt“ behält die rote Klasse, und ein gescheitertes Zurücksetzen wird nicht gemeldet.
3. **Chrome-Adapter:** Er könnte selbst „Extension context invalidated“ werfen, wenn `chrome.runtime.id` fehlt (sonst erscheint ein allgemeiner Text). Nicht verifiziert.
4. **Feinschliff:**
   - `reportUnexpected` zeigt bei Gründen, die kein Error sind, „[object Object]“.
   - Bei DOMException steht die volle Meldung statt eines kurzen Grunds.
   - `pointercancel` statt einen begonnenen Druck zu Ende zu führen.

## Vorbefunde aus dem Gesamt-Review P3b (2026-11-26, zurückgestellt)
1. **Neustart der Bridge:** Er wird nur an einem kleineren Zähler erkannt. Eine Seiten-Nonce im Snapshot wäre wasserdicht. In der Praxis laden Bot und Bridge immer gemeinsam neu.
2. **Team-Signatur im Live-Test:** Sie hängt von der Reihenfolge ab, also zählt ein Tausch als Fortschritt. Fix: sortieren.
3. **Verweildauer bei offenen oder abgebrochenen Runs:** `screenTimes` fehlt die laufende Verweildauer des aktuellen Bildschirms, damit auch die des Stillstands selbst.
4. **`item:skip` als Option:** Es wird gewählt, steht aber nicht unter den Item-Optionen.
5. **Neuladen auf dem Game-Over-Bildschirm:** Das erzeugt einen einzeiligen Schein-Run mit Niederlage. Der doppelte `stats.runs`-Zähler bestand schon vorher. Das verzerrt A/B-Zählungen.
6. **`waitForEffect`:** Die Prüfung endet beim ersten Fehler im Observer. Fix: kurzzeitige Fehler ignorieren, nur am Timeout als `false` werten.
7. **Zeitlimit des Live-Tests:** Es berücksichtigt `LIVE_STALL_MIN` nicht (`playwright.config.ts`).
8. **Speicher und Exportgröße:**
   - Das Profil wird für jede Zeile neu angelegt.
   - Im ungünstigsten Fall wird der Export etwa 40 MB groß (10 × 3000 Zeilen). Auf dem iPhone beobachten.
9. **Kleinkram:**
   - `RunError.t` ist in Epoch-ms, sonst wird ISO verwendet.
   - `exportFileName` verwendet UTC.

## Vorbefunde aus dem Gesamt-Review P3a (2026-11-26, zurückgestellt)
Die kleinen Funde mit Fix-Idee kommen in ein späteres P3-Inkrement bzw. nach P5:
1. **Der KP-Hash schwächt die Wirkungsprüfung im Kampf.** Bleibt SKIP nach einem Klick bedienbar, klickt der Bot ihn alle 1 bis 3 s erneut, statt einen Fehlschlag zu melden. Fix: `ScreenInfo` aufteilen in `signature` (Wirkung, `failKey`) und `progress` (KP, nur für den Watchdog). Dazu einen Replay-Test mit `watchdogSec=15` und einem Kampf von 33,4 s.
2. **Diagnose bei nicht bedienbaren Zielen:**
   - `lastDecision` zeigt „click: …“, obwohl nicht geklickt wird.
   - Eine Debug-Zeile je Tick füllt den Ring.
   - Die `stalled`-Meldung nennt das Ziel nicht.
   - Fix: die Log-Zeile nur einmal je Schlüssel schreiben, „wait: target not actionable“ anzeigen, die letzte Entscheidung in die Stall-Meldung aufnehmen.
3. **Je Mutations-Batch ein voller `detectScreen` samt `getComputedStyle` in `waitForEffect`.** Auf dem iPhone ist das teuer. Fix: höchstens einmal pro Frame bzw. alle 100 ms prüfen, vorher eine billige Prüfung am Element.
4. **`pointer-events:none` am Elternelement ist ungetestet.** happy-dom vererbt es nicht, Browser schon. Fix: eine Prüfung mit Playwright auf der Stub-Seite.
5. **Kleinkram:**
   - `engine.ts` meldet „skip pressed“ auch bei `pointer-events:none`.
   - Das Etikett „Watchdog (s)“ ist Jargon (P5, R-174).
   - `|| !el` in `doClick` ist nur ein Typ-Workaround.

## Vorbefunde aus Gesamt-Review und Review-Tor P2 (2026-11-26)
- Gesamt-Review: Die zurückgestellten Minor-Funde (no-silent-catch-Lücken, R-032-Umgehungen, `typeof`-Ausnahme, Hook-Timeout-Test, perl-Kindprozesse, flacher/partieller Klon, Budget-Check ohne Git, Schreiben vor Prüfen, Doppelpräfix) sind **im Review-Tor P2 behoben**.
- ui-reviewer und strategy-reviewer: „nicht anwendbar“ für P2. Ihre Funde stehen vollständig in `docs/superpowers/audits/2026-11-26-p2-gate-ui-strategy.md` (mit Fix- und Test-Vorschlag sowie R-ID):
  - **P3:** SKIP-Hänger (R-087, R-094, R-190), Run-Logs (R-006, R-009), Live-Urteil (neu R-254), Heilung beim Kartenwechsel klären.
  - **P4:** Lead-Tausch auf der Karte, Boss-Reihenfolge bei 100 %, Fangwahl bei Sättigung, R-250, R-251.
  - **P5:** Kontrast von `<select>` und Checkbox auf WebKit hell, Verdeckung, Touch-Ziele, Safe Area, Screenshot-Befehl, `:focus-visible`-Fallback.
- Review-Tor P2, Runde 3 (requirements-reviewer), Vorbefunde für P3:
  - ~~Verhaltenstest mit Typinformation für die Lint-Regeln~~ → erledigt in Runde 4 (`tests/unit/lint-behaviour.test.ts`, D-036).
  - `Promise.allSettled([...])` mit ignorierten Ergebnissen schluckt Rejections. Gehört zum Laufzeit-Handler (R-200, D-036).
  - Globaler `unhandledrejection`-Handler (R-200, D-036).
  - Speicherfehler auch auf der Optionsseite zeigen (R-259).
  - In der echten Hook-Ausgabe (≈ 8,9 KB) kommt von „Erledigt“ nur der erste Unterpunkt an. Beobachten und den Eintrag knapp halten.

## Bekannte Probleme
- **Live-Lauf 1 (P1, 2026-11-25, Story Classic Kanto, frisches Profil):** Nach 2,3 Minuten 3 Orden, 31 Fortschrittsschritte, Team Venusaur 36, Weepinbell 31, Beedrill 31, Butterfree 31, Magnemite 29. Dann **Pause**: „action keeps failing: no effect after clicking #btn-auto-battle[0]“ im Bosskampf auf Karte 3 (Knoten `n8_0`). Der Test zählt das als „bestanden“, weil er nur Fortschritt prüft. Er muss Hänger künftig als Fehler werten (R-190). Möglicherweise hat parallele CPU-Last durch E2E-Läufe eines Reviewers mitgewirkt. Wiederholung ohne Parallelität und mit `PKBOT_OUT=artifacts/live` steht aus. Gespeichert wurde in fast jedem Bildschirm (Karte 17×, Kampf 17×, Item 3×, Fang 2×, Elite-Prep 2×), gut für Resume (R-194).
- **Live-Lauf 2 (P1, 2026-11-25, isoliert, `PKBOT_OUT=artifacts/live`):** 6,5 Minuten, 105 Fortschrittsschritte. Laut Overlay-Zähler 4 Runs, 0 Siege, 4 Niederlagen (Brock, 2× Normalkampf Karte 2, Misty). Dann **derselbe Hänger wie in Lauf 1** im Arenakampf gegen Erika. **Korrigierte Diagnose (Review-Tor P1):** Der Kampf lief noch, SKIP war gesperrt. Der Bot wertet „läuft noch“ als „Klick ohne Wirkung“ und pausiert nach ≈15 s Backoff. Das Kampfende nach Niederlagen funktioniert dagegen (GAME_RECON §12.8). **Erste Aufgabe in P3:** gesperrte Knöpfe nicht klicken, sondern warten, und Kampffortschritt erkennen (R-087, R-094, R-190). Außerdem gesehen: „Runs fortsetzen“ steht standardmäßig an (R-214).
- **Live-Lauf 4 (P3a, 2026-11-26, `LIVE_MINUTES=10`):** **Kein Hänger mehr.** `liveVerdict` leer, 143 Fortschrittsschritte, 6 Runs (0 Siege, 6 Niederlagen), bis zu 7 Orden (Karte 7). 78 Kämpfe: Median 3,0 s, längster 33,4 s. Die Niederlagen sind Strategie (P4).
- **Live-Lauf 3 (P2, 2026-11-25, `LIVE_MINUTES=8`, isoliert, `PKBOT_OUT=artifacts/live`):** Nach 2,5 Minuten 4 Orden, 36 Fortschrittsschritte, Team Venusaur 41 (besiegt), Golduck 42, Beedrill 30, Marowak 30, Omanyte 31. Dann **derselbe Hänger** auf Karte 3, Knoten `n8_0` („action keeps failing: no effect after clicking #btn-auto-battle[0]“). Der Live-Test wertet das jetzt korrekt als **Fehlschlag** (R-082). Behoben wird der Hänger in P3.
- Playwright leert `test-results/` bei jedem Start. Live-Läufe deshalb mit `PKBOT_OUT=artifacts/live` starten und nie parallel zu anderen Playwright-Läufen.
- ~~`playwright.config.ts` nutzt für `userscript-webkit-iphone` das unveränderte iPhone 13 (390×664, entspricht `iphone-safari`). Es fehlt `iphone` mit 390×844 (UI.md §1). Wird in P2/P5 korrigiert.~~ Behoben in P2 Task 5: Projekte `userscript-desktop`, `userscript-iphone` (390×844), `userscript-iphone-safari`, `userscript-iphone-se`.
- `dist/` ist gitignored. Für die GitHub-raw-Links (R-203) muss das in Phase 7 angepasst werden.
- backloggd.com ist aus der Cloud-Umgebung nicht erreichbar (DNS-Fehler). pokelike.xyz und cdn.playwright.dev sind erreichbar.

## Erledigt (neueste oben)
- 2026-11-26 · Session 1, P3a und P3b:
  - **P3a „Kämpfe ohne Hänger“: umgesetzt und live belegt.**
    - Ergebnis: Der Bot klickt nur noch bedienbare Ziele, die Kampfsignatur enthält den KP-Fortschritt, dazu kommt ein Watchdog.
    - Live-Lauf vom 2026-11-26: 10 min ohne Hänger, bis zu 7 Orden, 6 Runs.
    - Gesamt-Review (frischer Reviewer): Urteil „mit Korrekturen“, keine kritischen Funde, alle wichtigen Funde behoben:
      - Der Watchdog startet nach Zeitlücken neu und meldet `stalled` nur nach einem Neueinlesen.
      - Zwei Prüfschwerpunkte sind jetzt getestet und mit Mutationsproben belegt.
      - Die Wirkungsprüfung hängt nicht mehr, wenn eine Prüfung wirft.
    - 345 Unit-Tests grün. Die kleineren Funde stehen unten unter „Vorbefunde aus dem Gesamt-Review P3a“.
  - **P3b „Run-Logs, Live-Urteil, MAIN-Welt-Fehler“: umgesetzt, live belegt, Gesamt-Review bestanden (D-038).**
    - Gesamt-Review: Urteil „mit Korrekturen“, 0 kritische und 4 wichtige Funde, alle behoben. Dazu 2 hochgestufte kleine Funde und einer nebenbei:
      - Bossname nur für dieselbe Karte bzw. Top-4-Stufe.
      - Wiederholte Fehler zählen je Run.
      - Pausenzeit ist keine Verweildauer.
      - Zeitstempel vorgemerkter Fehler.
      - Abbruchgrund bei einer Pause am Ende.
      - Ein Recorder-Fehler hält den Bot nie an.
    - Kleinere Funde siehe „Vorbefunde aus dem Gesamt-Review P3b“.
    - Spec `docs/superpowers/specs/2026-11-26-p3b-run-logs-design.md`, Plan `docs/superpowers/plans/2026-11-26-p3b-run-logs.md`, 8 Tasks inline mit TDD.
    - **Run-Logs nach D-005:**
      - Jede Entscheidung mit Zustand, Optionen und Scores (Karte, Fang, Item, Starter), Wahl, Begründung, Konfidenz und Ergebnis.
      - Zusammenfassung je Run mit Ergebnis, Fortschritt, Todesursache, Kampfdauern und Fehlern.
      - Export über das Overlay. Übernahme mit `npm run runs:import` nach dem Geheimnis-Scan.
    - **Pausen mit Art, MAIN-Welt-Fehler im Log, Live-Urteil mit Budgets je Bildschirm und Nachlauf.**
    - **Live 2026-11-26:**
      - Lauf 1: Urteil leer, 197 Fortschrittsereignisse, 6 Runs bis 5 Orden. Dabei gefunden: `boss: null`, behoben.
      - Lauf 2: Urteil leer, 207 Fortschrittsereignisse, 5 Runs bis 6 Orden.
      - Die 5 Runs aus Lauf 2 liegen unter `runs/`.
    - 411 Unit-Tests, 44 E2E-Tests bestanden, 3 gewollt übersprungen.
- 2026-11-26 · Session 1: **Phase 2 abgeschlossen, Review-Tor bestanden.**
  - requirements-reviewer: bestanden in Runde 7, nach 6 Runden mit Funden; ui- und strategy-reviewer: nicht anwendbar, ihre Vorbefunde siehe oben.
  - Ergebnis: verlässliche Build-Pipeline mit automatischen Checks für Userscript-API, Metadaten, ES2020/Safari 15, Artefakte, Import-Grenzen und stille Fehler (inkl. typbewusster Regeln, Bedrohungsmodell D-036), außerdem `check:docs` und Hook mit Branch-Warnung und vollständiger Kurzform.
  - Stand: `vitest` 308/308, E2E 35 bestanden und 3 übersprungen. Aktuelle Phase ist jetzt **P3**.
- 2026-11-26 · Session 1, P2:
  - **Tasks 1–9** nach `docs/superpowers/plans/2026-11-25-phase2-geruest-build.md`, mit Gesamt-Review (frischer Reviewer: 0 Critical, 6 Important behoben).
  - Ergebnis: `noteError` und ESLint-Regel gegen stille Fehler, Import-Grenzen, Userscript nur mit der GM-Schnittmenge und Fallback `pkbot.*`, `@grant` aus der Nutzung, Update-URLs, lesbare ES2020-Bridge, Bundle-Check (Syntax, Safari 15), `check:userscript`, `check:docs`, Branch-Warnung im Hook, E2E auf allen Viewports aus UI.md, Live-Urteil mit Stillstandserkennung, USERSCRIPT_API.md, CHANGELOG.
  - Entscheidungen D-031 bis D-034, neue R-252 und R-253.
- 2026-11-25 · Session 1: **Phase 1 abgeschlossen, Review-Tor bestanden** (requirements-reviewer Runde 3: bestanden; ui- und strategy-reviewer: nicht anwendbar, Vorbefunde siehe oben). Ergebnis: Sim-Seeds aus dem sichtbaren Zustand (R-248), Actor-Guard (R-147), WebKit in der Cloud (R-065), Aufklärung im Spielcode und in den Wikis (GAME_RECON §11 bis §13), Bestandsaufnahme aller 251 R-IDs (Prüfprotokolle in `docs/superpowers/audits/`), Zielwert (D-027). Aktuelle Phase ist jetzt **P2**.
- 2026-11-25 · Session 1: Review-Tor P1, Runde 1. ui-reviewer und strategy-reviewer: „nicht anwendbar“, ihre Vorbefunde stehen oben. requirements-reviewer: nicht bestanden wegen Doku-Nacharbeit, alles eingearbeitet: R-016, R-244 und R-248 mit durchgestrichener alter Fassung, R-036 und R-064 nachgebessert (pokelike-guide.fr gerendert), PLAN.md P1/P3 konsistent, GAME_RECON §7 und §10.5 markiert. **Korrektur der Hänger-Diagnose:** Der Kampf lief noch, SKIP war gesperrt. E2E auf HEAD `4d35525`: 17 bestanden, 1 gewollt übersprungen. Neu sind R-250 (kalibrierte Prognosen) und R-251 (Notbremse).
- 2026-11-25 · Session 1, P1 Tasks 4–7: Bestandsaufnahme vollständig (4 Prüfprotokolle in `docs/superpowers/audits/`, alle 249 R-Zeilen mit Status und Fundstelle). GAME_RECON bereinigt, mit gebündelten offenen Fragen (§13) und Wiki-Unterseiten (§11). Zielwert in D-027, R-020 nach P7 (D-028), Restlücken nach P3 (D-029). Live-Lauf 2 zeigt einen reproduzierbaren Hänger am Kampfende (§12.8), Ursache wahrscheinlich ein ausgegrauter Knopf, der als klickbar gilt.
- 2026-11-25 · Session 1, P1 Task 6 (Teil): Bestandsaufnahme durch 3 requirements-reviewer für E/F/H/N, G/J und I/K/L/M/O/P/Z. 151 R-Zeilen haben jetzt Status, Fundstelle und Lücke, die Prüfprotokolle liegen in `docs/superpowers/audits/`. Neu ist **R-249**: kein `await` unter dem Simulations-Seed. Der Guard sperrt zusätzlich Teilen, Shop/Vitamine und App-Installation (Tests 111/111).
- 2026-11-25 · Session 1, P1 Task 3: WebKit läuft in der Cloud (R-065 ✅). Die volle E2E-Suite ergab 17 bestanden und 1 gewollt übersprungen. Das Setup-Skript der Umgebung installiert künftig Abhängigkeiten und WebKit (D-026, R-016 🟡, in einer frischen Session bestätigen).
- 2026-11-25 · Session 1, P1 Task 2: Actor-Guard gegen Reset Run, Account und Taste R (`guard.ts`, R-147 🟡). Der Bot pausiert, statt es erneut zu versuchen. Tests 109/109, Chromium-E2E 12/12.
- 2026-11-25 · Session 1, P1 Task 1: Die Simulations-Seeds kommen jetzt aus dem sichtbaren Zustand (`sim-seed.ts`), nicht mehr aus dem echten Spielzufall (R-248 ✅, R-239 🟡). Die Kommentare in `simulator.ts` und `page-bridge.ts` sind korrigiert. Tests 102/102 grün, Lint und Build ebenfalls.
- 2026-11-25 · Session 1: **Git-Verlauf bereinigt** (D-024): private Autor-Adresse ersetzt, Spielstand-Datei aus dem Verlauf entfernt, `main` und Session-Branch per `--force-with-lease` neu gesetzt, Tree unverändert. Die Commit-Hashes in den Docs sind angepasst. Das Löschen des alten Branches lehnt der Proxy ab (403), das übernimmt der Nutzer.
- 2026-11-25 · Session 1: Delegierte Entscheidungen (D-023): Pokédollar bleibt streng, Verlauf wird bereinigt, alter Branch wird gelöscht.
- 2026-11-25 · Session 1: **Phase 0 abgeschlossen, Review-Tor bestanden (R-243).** Runde 3 lief erstmals mit echten Agententypen (R-022 ✅). requirements-reviewer: „bestanden“, B1 bis B5 behoben. ui-reviewer und strategy-reviewer: „für P0 nicht anwendbar“, ihre Vorbefunde stehen oben. Aktuelle Phase ist jetzt P1.
- 2026-11-25 · Session 1: Review-Tor P0, Runde 2: 6 Blocker und 14 Hinweise eingearbeitet (`fd3422f`). Dazu gehören die Abspaltung von R-244 (D-022), das Urteil in R-209, die Simulations-Ausnahme in D-018, das wiederhergestellte Run-Menü samt Taste R in GAME_RECON §10.6 und die neuen Punkte R-244 bis R-248.
- 2026-11-25 · Session 1: **Vorgänger-Branch `claude/pokelike-bot-extension-skalzp` übernommen** (Merge, D-016), nachdem der requirements-reviewer ihn gefunden hatte. Vorher geprüft: `npm ci`, `tsc` mit 0 Fehlern, `vitest` 98/98 grün, `npm run build` mit beiden Zielen. Docs zusammengeführt (GAME_RECON §1–9 vom Vorgänger plus §10, UI.md, README, CLAUDE.md). Die alten Anforderungen R1–R6 stehen als R-233 bis R-242 in REQUIREMENTS, die Review-Funde als R-220 bis R-232. Neue Entscheidungen D-016 bis D-021. Den Spielstand habe ich auf ein anonymisiertes Run-Beispiel reduziert, der volle Stand liegt nur privat (D-013).
- 2026-11-25 · Session 1: Repo-Sicherheitsscan über **alle Refs** (237 Blobs), mit `detect-secrets` und Regex: keine Secrets. Personendaten nur in den Commit-Metadaten (`c8c13a8`), dazu der Spielverlauf in `ad723db` (R-209).
- 2026-11-25 · Session 1: Review von Phase 0 durch den requirements-reviewer, als allgemeiner Subagent mit dessen Anweisungen. Er hat 10 Lücken, 2 unberechtigte ✅ und den übersehenen Branch gefunden. Alles ist eingearbeitet.
- 2026-11-25 · Session 1: Hauptauftrag wörtlich in `docs/AUFTRAG.md` gesichert und vollständig zerlegt (R-028 bis R-219, Phasen-Tags, Zuordnungstabelle). PLAN.md in P0 bis P7 (D-014). Hook mit Phasenfilter (D-015).
- 2026-11-25 · Session 1: Spielstand des Nutzers analysiert und bereinigt (D-013).
- 2026-11-25 · Session 1 (Einrichtung): CLAUDE.md, Gedächtnis-Dateien, `.claude/settings.json` mit beiden Plugins und SessionStart-Hook, drei Reviewer-Subagenten. Push nach `main` funktioniert (R-024).

---

## Übernommen aus dem Vorgänger-Branch (wörtlich, Stand 2026-11-25 09:34 UTC)
_Verweise wie (R4.2) beziehen sich auf die alten IDs, die Zuordnung zu den neuen R-IDs steht in der Tabelle am Ende von REQUIREMENTS.md. Diese Liste ist Material für die Bestandsaufnahme in Phase 1._

### Erledigt

- Recon aller Bildschirme, Fixtures, Versionserkennung v3.8 (R3.6, R3.5): `docs/GAME_RECON.md`.
- Gerüst, Core, Overlay, Chrome- und Userscript-Ziel, Unit- und E2E-Tests, README (R2, R3, R6).
- Simulation mit der Kampf-Engine des Spiels für Route, Bossreihenfolge, Fang und Top 4 (`docs/STRATEGY.md`).
- Story: **erster bestätigter Champion-Sieg** (Commit 07f98ec; Varianten-Messungen in `docs/STRATEGY.md`) (R4.1).
- Challenges: Navigation, Orden-Stufe, PC-Starter, Relikte; die Simulation berücksichtigt Traits (ce01aac) (R4.2).
- Relikte werden per Simulation gewählt: Angebot und Austausch nach simulierten Boss-Chancen mit den Hooks aus
  `PASSIVE_ITEM_POOL`, mit Heuristik als Fallback (8f6590d) (R4.4).
- Challenge-Starter vorab wählbar: Dropdown im Overlay mit dem PC aus dem Spielstand (nur gelesen) bzw. Dex-Nr. auf der
  Optionsseite. Gewählt wird das stärkste Exemplar der Art (8f6590d) (R4.3).
- 2026-11-25: **Erster Sieg in einer Arena-Challenge** im Live-Test (Donnerorden, Mega Mewtwo Y, 6 Relikte, 6:52 min).
- 2026-11-25: Der Bildschirm „Stufe geschafft“ (`endless-stage-complete`) ist automatisiert: Sieg zählen, dann zurück
  zu den Challenges (Tower: nächste Stufe).

### Offen / nächste Schritte

- Relikt-Simulation ist gesättigt, wenn die Boss-Chance schon bei 100 % liegt; dann braucht es ein feineres Maß
  (z. B. übrige HP oder spätere Bosse). Im Austausch-Dialog griff im Live-Test noch die Heuristik.
- Ein Carry-Pokémon trägt das Team (Mega Mewtwo); den Rest des Teams stärken und das Finale vorbereiten (R4.2).
- Augments erkennen und automatisieren, sobald sie live auftauchen (R4.2).
- Tages- und Wochen-Challenge live prüfen (R4.2).
- Live prüfen, ob der Knopf nach dem Challenge-Sieg (`#btn-stage-home`) zurück zur Challenge-Auswahl führt.
