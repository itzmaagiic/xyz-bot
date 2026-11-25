# Fortschritt

Einzige Quelle der Wahrheit für den **Stand der Umsetzung**. Verweise wie (R4.2) beziehen sich auf `docs/REQUIREMENTS.md`.
Nach jeder abgeschlossenen Aufgabe aktualisieren: Datum, Ergebnis, Messwerte, offene Punkte. Einträge nie kürzen;
überholte Punkte als erledigt markieren.

## Erledigt

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

## Offen / nächste Schritte

- Relikt-Simulation ist gesättigt, wenn die Boss-Chance schon bei 100 % liegt; dann braucht es ein feineres Maß
  (z. B. übrige HP oder spätere Bosse). Im Austausch-Dialog griff im Live-Test noch die Heuristik.
- Ein Carry-Pokémon trägt das Team (Mega Mewtwo); den Rest des Teams stärken und das Finale vorbereiten (R4.2).
- Augments erkennen und automatisieren, sobald sie live auftauchen (R4.2).
- Tages- und Wochen-Challenge live prüfen (R4.2).
- Live prüfen, ob der Knopf nach dem Challenge-Sieg (`#btn-stage-home`) zurück zur Challenge-Auswahl führt.
