# Plan – Phasen mit Ziel und Abnahmekriterien

Jede Phase endet mit dem **Review-Tor**: eigenes Review → `requirements-reviewer`, `ui-reviewer` und `strategy-reviewer` (parallel) → alle Funde beheben → erneut prüfen → Ergebnis in PROGRESS.md. Erst danach beginnt die nächste Phase.
Ein Reviewer ohne passendes Material, etwa der ui-reviewer ohne Oberfläche, meldet das ausdrücklich. Das gilt als „nicht anwendbar“, nicht als „bestanden“.
Allgemeines Abnahmekriterium jeder Phase: Alle R-IDs mit diesem Phasen-Tag sind ✅ mit Nachweis, oder sie sind begründet verschoben (D-Eintrag, Tag geändert).
Größere Aufgaben laufen innerhalb einer Phase nach dem Superpowers-Workflow (CLAUDE.md). Pläne liegen in `docs/superpowers/plans/` und nennen ihre R-IDs.

> **Ausgangslage nach dem Merge des Vorgänger-Branches (D-016):** Gerüst, Kern, Strategie mit Simulation, Overlay und beide Build-Ziele sind schon weitgehend vorhanden, inklusive eines Champion-Sieges. In den Phasen 2–7 geht es deshalb vor allem darum, Vorhandenes **mit Nachweis abzunehmen** und **Lücken zum Hauptauftrag zu schließen**. Die Reihenfolge der Phasen bleibt.

---

## Phase 0 – Einrichtung, Übernahme und Zerlegung des Auftrags ✅ (Session 1, 2026-11-25)
**Ziel:** Jede spätere Session arbeitet gründlich, selbstständig und ohne Vergessen. Vorhandene Arbeit ist übernommen, und der Auftrag ist vollständig in prüfbare Anforderungen zerlegt.
**R-IDs:** R-014, R-017 bis R-019, R-021, R-023 bis R-026, R-209, R-211, R-225, R-240, R-243
**Abnahmekriterien**
- [x] Die Gedächtnis-Dateien, Plugins, drei Reviewer-Subagenten und der SessionStart-Hook stehen (R-017 bis R-026). Die Prüfung, ob Plugins und Subagenten geladen werden, ist nach P1 verschoben (R-020, R-022, D-021).
- [x] Der Hauptauftrag steht wörtlich in `docs/AUFTRAG.md` und ist zerlegt (R-028 bis R-248), mit Zuordnungstabelle.
- [x] Alle Branches sind gesichtet und der Vorgänger-Branch ist übernommen (R-225, D-016).
- [x] Der Repo-Sicherheitsscan über alle Refs ist erledigt, das Urteil ist mitgeteilt (R-209). Fixtures liegen nur anonymisiert vor, private Stände sind gitignored (R-211, R-240). Das Bereinigen des Verlaufs ist nach P7 abgespalten (R-244, D-022).
- [x] Das Review-Tor ist bestanden (R-243): drei Runden, alle drei Reviewer. Der requirements-reviewer meldete „bestanden“, ui-reviewer und strategy-reviewer „nicht anwendbar“.

## Phase 1 – Bestandsaufnahme und Aufklärung
**Ziel:** Den übernommenen Code mit Nachweisen gegen alle R-IDs abgleichen und die Aufklärungslücken schließen. Für Bildschirme, die noch nicht live gesehen wurden, gilt: erst Aufklärung, dann Logik (R-224).
**R-IDs:** R-022, R-027, R-036, R-064, R-065, R-067 bis R-069, R-071, R-072, R-076 (sechs Aufklärungspunkte mit Restlücken nach P3 verschoben, siehe D-029)
**Abnahmekriterien**
- **Bestandsaufnahme:** Für jede R-ID ist geprüft, ob und wo sie im übernommenen Code umgesetzt ist. Der Status ist mit Nachweis gesetzt (✅ nur mit Test, Screenshot oder Prüfprotokoll, sonst 🟡 mit Fundstelle). `npm test`, `npm run e2e` und ein Live-Test sind gelaufen, die Ergebnisse stehen in PROGRESS.md. Der Zielwert für R-230 ist festgelegt.
- Die Plugins und die Agententypen `requirements-reviewer`, `ui-reviewer` und `strategy-reviewer` sind als ladbar bestätigt (R-020, R-022).
- Playwright mit Chromium **und** WebKit läuft in der Cloud (R-065, D-011).
- Mehrere Runs wurden selbst gespielt. **Jeder** Bildschirm ist in `docs/GAME_RECON.md` mit Erkennungsmerkmalen und Selektoren beschrieben, in deutscher **und** englischer Spielsprache.
- Geklärt sind DOM oder Canvas, das Framework, die CSP (mit Test, ob ein Seiten-Skript per script-Element läuft), der globale Zustand bzw. localStorage/IndexedDB, das Auslesen von Team und Karte, die Spieleinstellungen und die Spielversion. Vieles davon steht schon in GAME_RECON §1 bis §9 und ist hier nur gegenzuprüfen. Die offenen Fragen aus §7 und §10.5 sind beantwortet.
- Echte, bereinigte DOM-Snapshots jedes Bildschirms liegen in `tests/fixtures/dom/`.
- Jede Angabe aus HA §1 ist als bestätigt, widerlegt oder offen markiert. Die Wiki-Quellen sind ausgewertet.
- Die offenen Fragen sind in GAME_RECON.md gelistet und, wo möglich, beantwortet.

## Phase 2 – Projektgerüst und Build-Pipeline
**Ziel:** Jede Session kann sofort bauen, linten, testen und beide Ziele erzeugen. Der übernommene Stand (D-016) baut beide Ziele bereits. Hier werden Gerüst und Pipeline mit Nachweis abgenommen und die Lücken geschlossen, z. B. WebKit im SessionStart-Hook, Doku-Checks und iPhone-Viewport in `playwright.config.ts`.
**R-IDs:** R-015, R-016, R-032 bis R-034, R-078 bis R-082, R-098 bis R-100, R-102 bis R-105, R-107, R-192, R-193, R-199, R-201, R-208, R-232, R-246, R-247
**Abnahmekriterien**
- TypeScript strict, Bundler (Entscheidung in DECISIONS), ESLint, Prettier, Vitest und Playwright sind eingerichtet. `npm run build`, `build:chrome`, `build:userscript`, `test`, `lint` und `e2e` laufen grün.
- Die MV3-Erweiterung lässt sich in Chromium entpackt laden (E2E). Das Userscript hat einen vollständigen Metadaten-Block, und ein GM-Shim lädt es in Chromium und WebKit (E2E).
- Automatische Checks laufen: Import-Grenzen `core/`/`ui/` gegen `platform/` (R-032), erlaubte GM-API-Schnittmenge und `@grant`-Abgleich (R-192, R-104), Metadaten (R-193), keine leeren catch-Blöcke (R-199).
- Der API-Abgleich mit der README von quoid/userscripts ist dokumentiert (R-098).
- Das Setup-Skript der Cloud-Umgebung installiert die Abhängigkeiten idempotent, inklusive WebKit und seiner Bibliotheken (R-016, D-026). In einer frischen Session ist das bestätigt. Die Befehle stehen in CLAUDE.md. Das CHANGELOG ist angelegt.

## Phase 3 – Kern: Zustand, Bildschirme, Aktionen, Daten, Logs und Baseline-Run
**Ziel:** Der Bot erkennt jeden Bildschirm, handelt verlässlich und spielt mit einer einfachen, sicheren Baseline-Strategie einen kompletten Story-Run ohne Hänger.
**R-IDs:** R-006, R-007, R-009 bis R-013, R-038, R-042 bis R-057, R-083, R-084, R-086 bis R-089, R-091, R-093 bis R-095, R-101, R-106, R-108, R-109, R-115, R-145 bis R-148, R-186, R-190, R-200, R-212 bis R-215, R-219, R-222, R-226, R-227, R-229, R-231, R-237, R-238, R-241, R-242, R-245, R-249, R-066, R-070, R-073, R-075, R-077, R-224
**Abnahmekriterien**
- Der ScreenDetector besteht alle Fixture-Tests (R-186). Ein unbekannter Bildschirm führt zu Pause, Meldung und Snapshot.
- Der Actor nutzt Pointer- und Touch-Events, prüft die Wirkung jeder Aktion und arbeitet mit Backoff. Das Warten läuft über MutationObserver plus Stabilitätserkennung, dazu kommt der Watchdog.
- Plattform-Adapter, Typentabelle, Pokémon-Daten und das Log als Ringpuffer sind getestet.
- Fair Play und Datenschutz sind per Test belegt (R-145 bis R-148).
- **Meilenstein:** ein echter Story-Run bis Champ oder Game Over ohne Hänger, mit Log und Zusammenfassung unter `runs/` (R-190, R-007, R-009). Das ist die Baseline für Phase 4.
- Bis zu Phase 5 genügt eine minimale Steuerung (Start, Pause, Stopp, Status), die Gestaltung folgt dort.

## Phase 4 – Strategie (das Herzstück)
**Ziel:** Der Bot entscheidet wie ein erfahrener Spieler und gewinnt messbar öfter als die Baseline.
**R-IDs:** R-008, R-029 bis R-031, R-037, R-039 bis R-041, R-058 bis R-063, R-085, R-090, R-116 bis R-141, R-184, R-185, R-191, R-207, R-221, R-223, R-230, R-234 bis R-236, R-239, R-248
**Abnahmekriterien**
- Für jeden Entscheidungstyp gibt es eine reine Funktion mit Unit-Tests für konkrete Szenarien und alle Grenzfälle (R-184, R-185).
- Team-Bewertung, Vorausschau, Routenwahl, Fangen und Team Full, Items und Relikte, Tausch, Kampfreihenfolge, Shop, Tower-EVs, Profile und zentrale Gewichte sind umgesetzt.
- Alle Modi sind spielbar: Story Classic und Nuzlocke, Battle Tower, Challenges.
- Echte Runs zeigen, dass die Siegquote gegenüber der Baseline aus Phase 3 messbar steigt. Vorher und Nachher stehen in `docs/STRATEGY.md` (R-191).
- Der strategy-reviewer meldet keinen P0- oder P1-Fund (R-008).

## Phase 5 – Oberfläche
**Ziel:** Ein übersichtliches, schönes und mit dem Daumen bedienbares Overlay, dazu Popup und Optionsseite für Chrome.
**R-IDs:** R-001 bis R-005, R-074, R-092, R-110 bis R-114, R-142, R-143, R-149 bis R-183, R-216 bis R-218, R-220, R-228
**Abnahmekriterien**
- Das Design-System steht in `docs/UI.md`. Es gibt 2–3 Mockups mit Screenshots (Desktop 1440×900, iPhone 390×844), die Wahl ist in DECISIONS begründet. Umgesetzt wird mit frontend-design.
- Alle Steuerungen, Einstellungen (mit Erklärung und Standardwert), die Live-Anzeige, Statistik, Log mit Filter, Export und Import, Fehlermeldungen, „Debug-Infos kopieren“, i18n (Deutsch und Englisch), Tastenkürzel, die Lern-Auswertung und das Nachjustieren mit Bestätigung und Rückgängig sind umgesetzt.
- Jeder Zustand ist auf Desktop, iPhone und iPhone SE gescreenshottet. Mindestens zwei Runden mit dem ui-reviewer liegen hinter uns, keiner meldet mehr P0 oder P1. Ein Test belegt, dass kein Spielbutton verdeckt ist.
- Die finalen Screenshots liegen in `docs/screenshots/`.

## Phase 6 – Härtung und E2E auf allen Zielen
**Ziel:** Der Bot ist im Alltag robust, auf Chrome und iPhone.
**R-IDs:** R-028, R-035, R-096, R-097, R-187 bis R-189, R-194 bis R-198, R-233
**Abnahmekriterien**
- Echte Runs laufen erfolgreich mit der Chrome-Erweiterung, mit dem Userscript in Chromium und mit dem Userscript in WebKit (iPhone-Emulation, Touch), jeweils mindestens ein vollständiger Story-Run ohne Hänger.
- Getestet sind Reload mitten im Run (Resume), Spiel-Update (veränderte Fixtures), langsames Netz, Tab im Hintergrund und iOS-Display aus und an. Wake Lock wird genutzt, wo verfügbar.
- Das Userscript ist mit Tampermonkey und Violentmonkey kompatibel (Abgleich plus Shim-Tests).

## Phase 7 – Lieferung
**Ziel:** Der Bot ist fertig verpackt, dokumentiert und sicher veröffentlichbar.
**R-IDs:** R-020, R-144 (optional), R-202 bis R-206, R-210, R-244
**Abnahmekriterien**
- `dist/chrome/` plus zip, `dist/pokelike-bot.user.js` und `.meta.js` sind eingecheckt. Dafür muss `.gitignore` angepasst werden, denn `dist/` ist dort derzeit ausgeschlossen. Die GitHub-raw-Links funktionieren, und die Version ist überall gleich und erhöht.
- README (Deutsch), `docs/GAME_RECON.md`, `docs/STRATEGY.md`, `docs/UI.md`, `docs/screenshots/` und `CHANGELOG` sind vollständig.
- Der Secrets- und Personendaten-Scan per Skript ist grün (R-210).
- Optional ist der Löser für das Daily Pokésort umgesetzt (R-144).
- Alle R-Punkte sind ✅ oder begründet gestrichen. Alle drei Reviewer finden nichts mehr mit P0 oder P1.
