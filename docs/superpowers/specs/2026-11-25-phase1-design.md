# Phase 1 – Bestandsaufnahme und Aufklärung: Design

Stand 2026-11-25 · Freigabe nach CLAUDE.md (D-006) durch eigenes Review plus D-025 · Grundlage: `docs/PLAN.md` Phase 1, `docs/REQUIREMENTS.md`, `docs/PROGRESS.md` (Vorbefunde der Reviewer).

## Absicht
Der übernommene Code (D-016) kann schon viel. Was davon den Auftrag **nachweislich** erfüllt, ist aber offen, und die Aufklärung hat Lücken (§7, §10.5, §10.7 in GAME_RECON). Phase 1 schafft eine belastbare Ausgangslage: Jede R-ID bekommt einen ehrlichen Status mit Nachweis, und das Spielwissen ist live geprüft. Erst danach lohnt Arbeit an Kern, Strategie und Oberfläche.

## Ziele
- Jede R-ID hat einen Status mit Nachweis oder Fundstelle (PLAN P1, Bestandsaufnahme).
- WebKit läuft in der Cloud. `npm run e2e` ist in einer frischen Session grün (R-065, Vorarbeit für R-015 und R-016).
- Die offenen Aufklärungsfragen sind live oder im Spielcode geklärt: DE/EN, CSP-Test, Speicherzeitpunkt, Boss-Vorschau, Items mit Typwechsel, Trait-Schwelle, Nuzlocke-Regeln, Shop-Währung, Starter-Einstellung. Neue Bildschirme werden zu Fixtures (R-036, R-066 bis R-077, R-224).
- Die Wiki-Quellen sind gesichtet und als Hinweise dokumentiert (R-064).
- Der Zielwert für „starke Runs“ ist festgelegt (R-230).

## Nicht-Ziele
- Keine neuen Strategie- oder UI-Funktionen. Das ist Phase 3 bis 5. Ausnahme: die Fairness-Sofortmaßnahmen unten.
- Kein Umbau des Log-Formats, keine Pille, kein Design-System.

## Anti-Ziele (wäre ein Misserfolg, auch wenn es „funktioniert“)
- Ein Live-Lauf, der gegen Fair Play verstößt: Simulation aus echtem Zufall, mögliches Reset oder Logout per Taste oder Klick.
- Live-Läufe mit dem echten Konto des Nutzers (R-228). Es gibt nur frische, nicht eingeloggte Profile.
- ✅ ohne Nachweis, Statusvergabe nach Gefühl.
- Personendaten in neuen Fixtures oder Logs.

## Randbedingungen
- Die Cloud-Umgebung ist ephemer. Was jede Session braucht (WebKit-Bibliotheken), gehört in das Setup-Skript der Umgebung, das nur der Nutzer freigeben kann, oder in den SessionStart-Hook.
- Ein Live-Lauf kostet Echtzeit. Kurze, gezielte Läufe, keine Dauerläufe.
- Agenten-Budget: Subagenten nur, wo Parallelität echten Wert hat. Das ist die Bestandsaufnahme nach Abschnitten.

## Ansätze
1. **Zuerst Sicherheit, dann Messen, Aufklären und Abnehmen (gewählt).** Reihenfolge: Fairness-Sofortmaßnahmen → WebKit und volle Testläufe → Live-Aufklärung → Wiki → Bestandsaufnahme mit parallelen requirements-reviewern → Zielwert → Review-Tor. Vorteile: Kein Live-Lauf verletzt Fair Play, und die Bestandsaufnahme sieht den Stand nach Fixes und Aufklärung, muss also nicht doppelt laufen.
2. *Zuerst die Bestandsaufnahme:* Sie würde den Stand vor den Fixes bewerten und müsste danach teilweise wiederholt werden. Live-Läufe für Nachweise kämen vor den Fairness-Fixes. Verworfen.
3. *Nur die P1-Punkte, die anderen erst in ihren Phasen:* Das ist billiger, verfehlt aber das Abnahmekriterium von P1. Der Hook zeigte dann weiter fast alles als ❌, obwohl es existiert. Verworfen.

## Design (Arbeitspakete)
**AP1 – Fairness-Sofortmaßnahmen** (vorgezogen aus P3/P4, D-025, TDD)
- **Seeds:** Ein neues reines Modul `src/core/bridge/sim-seed.ts` bildet `simBase(sichtbarerZustand)` per FNV-1a-Hash über Karte, Knoten und Team (Art, Level, KP) und `simSeed(base, k, salt)`. `simulator.ts` nutzt dafür nie mehr `getRngSeed()`. `getRngSeed()` bleibt **nur** zum Sichern und Wiederherstellen. Die Entscheidungen sind damit deterministisch für den sichtbaren Zustand (R-030) und unabhängig vom echten Zufall (R-239, R-248).
- **Actor-Guard:** `pressKey` lässt nur eine Allowlist durch (Shift+Digit1–6 für den Lead-Tausch). Alles andere, besonders `R`, wird abgewiesen und geloggt. `click` und `drag` weisen Ziele aus einer Denylist ab: `[data-menu="reset"]`, `[data-menu="account"]`, Bestätigen im `reset-run-modal`, `confirmResetRun`. Eine Ausnahme gibt es nur über eine spätere Einstellung (R-165, P5). Das ist der Kern von R-147.
- Tests: Unit-Tests für `sim-seed` (Unabhängigkeit vom echten Seed, Determinismus) und für den Guard mit DOM-Fixture (Reset-Button, Taste R).

**AP2 – WebKit und volle Testläufe**
- WebKit für die gepinnte Playwright-Version installieren, die Bibliotheken per `npx playwright install-deps webkit` bzw. apt. `npm run e2e` vollständig laufen lassen. Dann ein Setup-Skript für die Umgebung vorschlagen, Freigabe durch den Nutzer (R-065).

**AP3 – Live-Aufklärung**
- Kurzer Live-Lauf (Story Classic, Kanto, frisches Profil) mit dem Bot und dem Live-Test. Ergebnis: ein erstes Log, beobachtete Bildschirme, Hänger.
- Spielcode im Browser lesen (Hauptkontext, nur lesend) für §10.5 und §10.7. CSP-Test per script-Element. Settings, Version, Speicherzeitpunkt von `poke_current_run`.
- Neue Bildschirme (z. B. Shop, Entwicklung, Stat-Buff) als bereinigte Fixtures sichern und in GAME_RECON aufnehmen. DE/EN über D-020 belegen: Detector-Tests auf DE- und EN-Fixtures.
- Abgleich HA §1 (GAME_RECON §10.1) vervollständigen.

**AP4 – Wiki** (R-064): pokelike.wiki und pokelike-guide.fr sichten (beide erreichbar) und in GAME_RECON festhalten, was dort an Gegner-Teams, Items und Traits steht, mit Quelle. Daten übernommen werden erst in P4 (R-221).

**AP5 – Bestandsaufnahme:** requirements-reviewer pro Abschnittsgruppe parallel, read-only. Sie liefern eine Tabelle aus R-ID, vorgeschlagenem Status, Nachweis oder Fundstelle und Lücke. Ich trage die Ergebnisse ein und vergebe ✅ nur mit Nachweis.

**AP6 – Zielwert R-230 und Abschluss:** Der Zielwert entsteht aus den Messwerten in STRATEGY.md und dem Live-Lauf. R-020 wird dokumentiert. Danach das Review-Tor mit allen drei Reviewern.

## Dem Umsetzer überlassen
Die Hash-Details, die genaue Allowlist bzw. Denylist (Erweiterungen begründen), Skript-Namen, die Länge des Live-Laufs (kurz halten) und die Gruppierung der Reviewer.
