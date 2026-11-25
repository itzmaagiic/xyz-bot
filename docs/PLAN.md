# Plan – Phasen mit Ziel und Abnahmekriterien

Jede Phase endet mit dem **Review-Tor**: eigenes Review → `requirements-reviewer`, `ui-reviewer` und `strategy-reviewer` (parallel) → alle Funde beheben → erneut prüfen → Ergebnis in PROGRESS.md. Erst danach beginnt die nächste Phase.
Reviewer ohne passendes Material, etwa der strategy-reviewer ohne echte Runs, melden das ausdrücklich. Das zählt dann nicht als „bestanden“.

> ⚠️ Die Phasen 2–7 sind **vorläufig** (D-009). Sie leiten sich aus dem Einrichtungsauftrag ab. In Phase 1 werden sie an den Hauptauftrag angepasst.

---

## Phase 0 – Einrichtung ✅ (Session 1, 2026-11-25)
**Ziel:** Jede spätere Session arbeitet gründlich, selbstständig und ohne Vergessen.
**Abnahmekriterien**
- [x] CLAUDE.md, REQUIREMENTS.md, PROGRESS.md, DECISIONS.md, PLAN.md, UI.md, GAME.md und AUFTRAG.md sind angelegt.
- [x] Die Plugins sind in `.claude/settings.json` über `enabledPlugins` aktiviert (D-001).
- [x] Die drei Reviewer-Subagenten liegen in `.claude/agents/`.
- [x] Der SessionStart-Hook gibt den Stand aus (manuell getestet).
- [x] Alles ist committet und gepusht.
- [ ] In Session 2 bestätigt: Plugins und Subagenten werden geladen (R-020, R-022).

## Phase 1 – Hauptauftrag erfassen und zerlegen ⛔ blockiert (Hauptauftrag fehlt)
**Ziel:** eine vollständige, prüfbare Anforderungsliste und ein darauf abgestimmter Plan.
**Abnahmekriterien**
- Der Hauptauftrag steht wörtlich in `docs/AUFTRAG.md`.
- Jeder Satz des Hauptauftrags ist mindestens einer R-ID zugeordnet. Dazu gibt es eine Zuordnungstabelle am Ende von REQUIREMENTS.md.
- Eigene Ergänzungen als Product Owner sind als `[eigene Idee]` eingetragen.
- Die Phasen 2–7 sind an den Hauptauftrag angepasst, jede R-ID ist einer Phase zugeordnet.
- Projektziel und Architektur-Abschnitt in CLAUDE.md sind aktualisiert.
- Der requirements-reviewer bestätigt, dass die Liste vollständig ist und kein Detail verloren gegangen ist.

## Phase 2 – Spielanalyse und Architektur (vorläufig)
**Ziel:** Pokelike genau verstehen und eine tragfähige technische Grundlage wählen.
**Abnahmekriterien**
- `docs/GAME.md` beschreibt jeden Spielbildschirm eines Runs: Erkennungsmerkmale, Bedienelemente mit Selektoren, mögliche Aktionen. Dazu kommen die Regeln, die für Entscheidungen zählen (Typen, Items, Relikte, Team-Limit, Bosse), und Strategie-Grundwissen.
- Die Architektur ist entschieden (D-Eintrag mit Alternativen und Begründung) und in CLAUDE.md beschrieben.
- Ein technischer Spike liest den Zustand mindestens eines Spielbildschirms automatisiert aus, durch einen Test belegt.

## Phase 3 – Grundgerüst und Test-Infrastruktur (vorläufig)
**Ziel:** Jede Session kann sofort bauen, testen, Screenshots erzeugen und Runs protokollieren.
**Abnahmekriterien**
- Ein Testbefehl läuft in einer frischen Cloud-Session grün, ohne manuelle Schritte (R-015, R-016).
- Ein Screenshot-Befehl erzeugt Desktop-, iPhone- und iPhone-SE-Screenshots nach D-004.
- Das Logging nach D-005 ist umgesetzt und getestet.
- Die Befehle stehen in CLAUDE.md.

## Phase 4 – Bot-Kern: Zustand erkennen und handeln (vorläufig)
**Ziel:** Der Bot spielt einen kompletten Run zuverlässig von Anfang bis Ende.
**Abnahmekriterien**
- Alle Bildschirme aus GAME.md werden erkannt, belegt durch Tests mit gespeicherten DOM-Snapshots.
- Ein echter Run läuft ohne Hängenbleiben bis „Game Over“ oder Sieg. Das Log liegt unter `runs/`.
- Unbekannter Zustand führt zu sicherem Stopp mit Meldung (R-010). Pause und Stopp funktionieren (R-011). Die Versionserkennung funktioniert (R-012).

## Phase 5 – Strategie (vorläufig)
**Ziel:** Der Bot spielt wie ein erfahrener Spieler.
**Abnahmekriterien**
- Jede Entscheidung ist mit Begründung geloggt (R-006).
- Mehrere echte Runs mit Zusammenfassung (R-007, R-009). Der Fortschritt ist gegenüber der Baseline aus Phase 4 messbar besser.
- Der strategy-reviewer meldet keinen P0- oder P1-Fund (R-008).

## Phase 6 – Oberfläche (vorläufig)
**Ziel:** eine übersichtliche, schöne und mit dem Daumen bedienbare Bot-Oberfläche auf Desktop und iPhone.
**Abnahmekriterien**
- Alle UI-Zustände haben Screenshots auf Desktop, iPhone und iPhone SE (R-001, R-005).
- Ein automatischer Test belegt, dass kein Spielbutton verdeckt wird (R-002).
- Der ui-reviewer meldet keinen P0- oder P1-Mangel (R-003, R-004).
- Umgesetzt mit frontend-design.

## Phase 7 – Härtung und Abschluss (vorläufig)
**Ziel:** robust im Alltag, vollständig dokumentiert.
**Abnahmekriterien**
- Alle R-Punkte sind ✅ mit Nachweis, oder sie sind begründet gestrichen.
- Fehlerfälle sind getestet: Netzwerkfehler, Spiel-Update, Neuladen mitten im Run.
- Die README erklärt Nutzung und Installation für den Nutzer.
- Alle drei Reviewer finden nichts mehr mit P0 oder P1.
