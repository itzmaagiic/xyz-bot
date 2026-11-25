# Fortschritt

**Stand:** 2026-11-25
**Aktuelle Phase:** P1
_(Phase 0 ist abgeschlossen, das Review-Tor ist bestanden. Jetzt kommt Phase 1: Bestandsaufnahme und Aufklärung, siehe `docs/PLAN.md`.)_

## In Arbeit
- **Phase 1** nach Plan `docs/superpowers/plans/2026-11-25-phase1-bestandsaufnahme.md` (Design: `docs/superpowers/specs/2026-11-25-phase1-design.md`, D-025). Task 1 (Seeds) ist erledigt, aktuell: Task 2, Actor-Guard.

## Nächster Schritt
1. **Session 2, zuerst:** Die Projekt-Aktivierung der Plugins prüfen (R-020, D-021). In der Cloud kommen sie auch über den Konto-Sync, ein unterscheidender Nachweis gelingt nur lokal (`/plugin`). Die Agententypen sind bestätigt (R-022 ✅).
2. **Phase 1, Bestandsaufnahme:** `npm ci`, `npm test`, `npm run e2e` und einen kurzen Live-Test laufen lassen. Dann jede R-ID gegen den übernommenen Code prüfen und den Status mit Nachweis setzen (✅ nur mit Test, Screenshot oder Prüfprotokoll). Dafür am besten den requirements-reviewer pro Abschnitt einsetzen.
3. **Phase 1, Aufklärung:** WebKit samt Bibliotheken lauffähig machen (D-011, R-065). Die offenen Fragen in `docs/GAME_RECON.md` §7 und §10.5 klären. Den Zielwert für „starke Runs“ festlegen (R-230).
4. Für Phase 1 einen Superpowers-Plan anlegen (`docs/superpowers/plans/`) mit den R-IDs aus PLAN.md.

## Entscheidungen (Nutzer hat delegiert, D-023)
- **Pokédollar:** Die strenge Regel bleibt, Ausgaben nur mit Freigabe, Budget-Standard 0. **Erledigt.**
- **Git-Verlauf bereinigt** (nach ausdrücklicher Freigabe, D-024). In `main` und im Session-Branch gibt es keine private Mailadresse und keinen Spielstand mehr. **Erledigt.**
- **Alten Branch `claude/pokelike-bot-extension-skalzp` löschen: Das muss der Nutzer tun.** Der Git-Proxy der Session lehnt das Löschen mit 403 ab. Der Branch enthält noch den alten Initial-Commit mit der privaten Adresse. Weg: im Browser, nicht in der GitHub-App, `github.com/itzmaagiic/xyz-bot/branches` öffnen und beim Branch das Papierkorb-Symbol wählen (iPhone: „Desktop-Website anfordern“). Laut GitHub-API ist der Branch nicht geschützt und hat keinen offenen PR. Der Nutzer löscht ihn später (Stand 2026-11-25). **Jede Session prüft zu Beginn mit `git ls-remote origin`, ob er noch existiert, und erinnert den Nutzer vor einer Veröffentlichung daran.** Ist er weg, R-244 auf ✅ setzen.

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

## Bekannte Probleme
- **Reset per Tastatur:** „Reset Run“ hat das Tastenkürzel `R`. Phase 1 muss prüfen, dass die Tastatur-Aktionen des Actors (z. B. Shift+Ziffer) nie `R` senden können (R-147).
- `playwright.config.ts` nutzt für `userscript-webkit-iphone` das unveränderte iPhone 13 (390×664, entspricht `iphone-safari`). Es fehlt `iphone` mit 390×844 (UI.md §1). Wird in P2/P5 korrigiert.
- **WebKit startet in der Cloud noch nicht:** Der Download klappt, aber Systembibliotheken fehlen (`libgtk-4.so.1`, `libgraphene-1.0.so.0` u. a.). Lösung in Phase 1 (D-011).
- **Fast alle R-Punkte sind formal noch ❌.** Der übernommene Code erfüllt viele davon wahrscheinlich schon, aber ohne Abnahme mit Nachweis. Das ist Phase 1.
- R-020 und R-022 lassen sich erst in einer neuen Session prüfen (D-021).
- `dist/` ist gitignored. Für die GitHub-raw-Links (R-203) muss das in Phase 7 angepasst werden.
- backloggd.com ist aus der Cloud-Umgebung nicht erreichbar (DNS-Fehler). pokelike.xyz und cdn.playwright.dev sind erreichbar.

## Erledigt (neueste oben)
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
