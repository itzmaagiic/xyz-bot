# Fortschritt

**Stand:** 2026-11-25
**Aktuelle Phase:** P0
_(Phase 0 ist fast abgeschlossen. Offen ist nur noch das Review-Tor R-243, also die erneute Prüfung nach den Korrekturen. Danach folgt Phase 1: Bestandsaufnahme und Aufklärung, siehe `docs/PLAN.md`.)_

## In Arbeit
- Review-Tor Phase 0 (R-243): Die Funde des requirements-reviewer sind eingearbeitet, die erneute Prüfung läuft.

## Nächster Schritt
1. **Session 2, zuerst:** Prüfen, ob die Agententypen `requirements-reviewer`, `ui-reviewer` und `strategy-reviewer` per `subagent_type` aufrufbar sind (R-022). Die Plugins prüfen (R-020, D-021).
2. **Phase 1, Bestandsaufnahme:** `npm ci`, `npm test`, `npm run e2e` und einen kurzen Live-Test laufen lassen. Dann jede R-ID gegen den übernommenen Code prüfen und den Status mit Nachweis setzen (✅ nur mit Test, Screenshot oder Prüfprotokoll). Dafür am besten den requirements-reviewer pro Abschnitt einsetzen.
3. **Phase 1, Aufklärung:** WebKit samt Bibliotheken lauffähig machen (D-011, R-065). Die offenen Fragen in `docs/GAME_RECON.md` §7 und §10.5 klären. Den Zielwert für „starke Runs“ festlegen (R-230).
4. Für Phase 1 einen Superpowers-Plan anlegen (`docs/superpowers/plans/`) mit den R-IDs aus PLAN.md.

## Entscheidungen des Nutzers, die offen sind (nicht blockierend)
- **Git-Verlauf vor der Veröffentlichung:** Commit `c8c13a8` enthält die Gmail-Adresse als Autor, Commit `ad723db` die bereinigte volle Fassung des Spielstands (R-209, R-240). Entfernen geht nur per Rewrite mit Force-Push auf `main`. Das braucht die ausdrückliche Zustimmung des Nutzers.
- **Alter Branch `claude/pokelike-bot-extension-skalzp`:** Er ist vollständig in `main` übernommen (D-016). Löschen auf GitHub nur mit Zustimmung.
- **Pokédollar:** Laut D-017 gilt die strengere frühere Regel, also Ausgaben nur mit Freigabe. Der Nutzer kann das lockern.

## Bekannte Probleme
- **WebKit startet in der Cloud noch nicht:** Der Download klappt, aber Systembibliotheken fehlen (`libgtk-4.so.1`, `libgraphene-1.0.so.0` u. a.). Lösung in Phase 1 (D-011).
- **Fast alle R-Punkte sind formal noch ❌.** Der übernommene Code erfüllt viele davon wahrscheinlich schon, aber ohne Abnahme mit Nachweis. Das ist Phase 1.
- R-020 und R-022 lassen sich erst in einer neuen Session prüfen (D-021).
- `dist/` ist gitignored. Für die GitHub-raw-Links (R-203) muss das in Phase 7 angepasst werden.
- backloggd.com ist aus der Cloud-Umgebung nicht erreichbar (DNS-Fehler). pokelike.xyz und cdn.playwright.dev sind erreichbar.

## Erledigt (neueste oben)
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
- Story: **erster bestätigter Champion-Sieg** (Commit 1ac0cec; Varianten-Messungen in `docs/STRATEGY.md`) (R4.1).
- Challenges: Navigation, Orden-Stufe, PC-Starter, Relikte; die Simulation berücksichtigt Traits (007bcf6) (R4.2).
- Relikte werden per Simulation gewählt: Angebot und Austausch nach simulierten Boss-Chancen mit den Hooks aus
  `PASSIVE_ITEM_POOL`, mit Heuristik als Fallback (5eabb60) (R4.4).
- Challenge-Starter vorab wählbar: Dropdown im Overlay mit dem PC aus dem Spielstand (nur gelesen) bzw. Dex-Nr. auf der
  Optionsseite. Gewählt wird das stärkste Exemplar der Art (5eabb60) (R4.3).
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
