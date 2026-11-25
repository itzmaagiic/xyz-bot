# Anforderungen – einzige Quelle der Wahrheit

**Legende:** ✅ erledigt und nachweislich getestet · 🟡 teilweise · ❌ offen
**Format jeder Zeile:** `- <Status> **R-NNN** <prüfbare Anforderung> — Quelle: … — Nachweis: …`
**Quellen:** `[HA]` Hauptauftrag (`docs/AUFTRAG.md`) · `[EA]` Einrichtungsauftrag, Session 1 · `[eigene Idee]` sinnvolle eigene Ergänzung

**Regeln**
- ✅ gibt es nur mit Nachweis: einem Test (`tests/…:Testname`), der die Anforderung wirklich prüft und gerade grün ist, oder einem aktuellen Screenshot (`screenshots/…png`). Ohne Nachweis ist ein Punkt höchstens 🟡.
- IDs werden nie neu vergeben und nie umnummeriert. Ein neuer Punkt bekommt die nächste freie Nummer, auch wenn er thematisch in einen früheren Bereich gehört.
- Nichts wird gelöscht oder zusammengekürzt. Ist ein Punkt überholt, wird er `~~durchgestrichen~~` und bekommt Begründung und D-Verweis (`docs/DECISIONS.md`).
- Jeder Satz des Hauptauftrags in `docs/AUFTRAG.md` muss mindestens einer R-ID zugeordnet sein.
- Nächste freie ID: **R-028**

> ⚠️ BLOCKER: Der Hauptauftrag fehlt. In der Einrichtungs-Session vom 2026-11-25 stand nach „HAUPTAUFTRAG:“ kein Text. Nächster Schritt: Hauptauftrag vom Nutzer holen, wörtlich in docs/AUFTRAG.md sichern und hier vollständig in R-Punkte zerlegen. Danach diese Zeile entfernen.

Bis dahin stehen hier nur Anforderungen, die sich aus dem Einrichtungsauftrag ergeben, sowie als `[eigene Idee]` markierte Ergänzungen.

---

## A. Oberfläche (Desktop und iPhone)
- ❌ **R-001** Die Bot-Oberfläche ist auf Desktop (1440×900) und iPhone (Playwright `iPhone 15 Pro`) voll bedienbar. Für jeden UI-Zustand gibt es einen aktuellen Playwright-Screenshot in beiden Größen. — Quelle: [EA] ui-reviewer bewertet „Playwright-Screenshots (Desktop und iPhone)“ — Nachweis: –
- ❌ **R-002** Die Bot-Oberfläche verdeckt in keinem Spielbildschirm einen Spielbutton und macht keinen unklickbar. Ein automatischer Test prüft das über die Überschneidung der Bounding-Boxen, Screenshots belegen es. — Quelle: [EA] „verdeckte Spielbuttons“ — Nachweis: –
- ❌ **R-003** Auf dem iPhone ist die Oberfläche mit dem Daumen bedienbar: Touch-Ziele mindestens 44×44 pt, häufige Aktionen in der Daumenzone (unteres Bildschirmdrittel), keine Funktion nur per Hover. — Quelle: [EA] „Daumen-Bedienung“. Die Maße sind eine eigene Konkretisierung nach Apple HIG. — Nachweis: –
- ❌ **R-004** Übersicht, Hierarchie, Lesbarkeit und Abstände erfüllen alle Kriterien aus `docs/UI.md`. Der ui-reviewer meldet keinen P0- oder P1-Mangel. — Quelle: [EA] — Nachweis: –
- ❌ **R-005** Die Oberfläche funktioniert auch auf kleinen iPhones (Playwright `iPhone SE`, 375×667) und hält die Safe Areas ein (Notch, Home-Indicator). — Quelle: [eigene Idee] — Nachweis: –

## B. Bot-Entscheidungen, Strategie und Logs
- ❌ **R-006** Jede Bot-Entscheidung wird bei einem echten Run protokolliert, mit Spielzustand, verfügbaren Optionen, gewählter Option und Begründung. Format nach D-005, Ablage unter `runs/`. — Quelle: [EA] strategy-reviewer „anhand der Logs echter Runs“ — Nachweis: –
- ❌ **R-007** Es gibt Logs echter Runs gegen das echte pokelike.xyz, nicht nur simulierte. Sie liegen im Repo und lassen sich auswerten. — Quelle: [EA] — Nachweis: –
- ❌ **R-008** Der Bot trifft keine dummen oder riskanten Entscheidungen. Der strategy-reviewer findet in den Logs der letzten echten Runs keinen P0- oder P1-Fund. — Quelle: [EA] — Nachweis: –
- ❌ **R-009** Jeder Run hat eine Zusammenfassung: Ergebnis, erreichter Fortschritt (z. B. Orden, Etage, Map), Dauer, Spielversion und Todesursache bzw. Grund für den Abbruch. — Quelle: [eigene Idee] Ohne sie lässt sich Strategie-Fortschritt nicht messen. — Nachweis: –

## C. Robustheit und Sicherheit
- ❌ **R-010** Erkennt der Bot einen unbekannten oder unerwarteten Spielbildschirm, klickt er nicht blind weiter. Er hält sicher an, protokolliert den Zustand mit einem Screenshot und meldet ihn. — Quelle: [eigene Idee] — Nachweis: –
- ❌ **R-011** Der Bot lässt sich jederzeit sofort pausieren und stoppen (Not-Aus), auch mitten in einer Aktion. — Quelle: [eigene Idee] — Nachweis: –
- ❌ **R-012** Der Bot erkennt die Spielversion (derzeit „v3.8“ im Hauptmenü). Bei einer unbekannten Version warnt er, statt still falsch zu spielen. — Quelle: [eigene Idee] Updates des Spiels können die Bildschirmerkennung brechen. — Nachweis: –
- ❌ **R-013** Der Bot geht fair mit dem Spiel um: menschenähnliche Pausen zwischen Aktionen, keine übermäßigen Anfragen, keine Manipulation von Spielstand oder Netzwerkverkehr, sofern der Hauptauftrag nichts anderes festlegt. — Quelle: [eigene Idee] — Nachweis: –

## D. Plattform und Technik
- ✅ **R-014** Das Projekt braucht kein Safari und kein Xcode. Alte Safari- oder Xcode-Teile werden entfernt. — Quelle: [EA] „lösche … alles für Safari/Xcode“ — Nachweis: Repo-Prüfung am 2026-11-25 (`find . -path ./.git -prune -o -type f -print` zeigte nur `README.md`, keine Safari- oder Xcode-Dateien)
- ❌ **R-015** Tests, Screenshots und Runs laufen in der Claude-Code-Cloud-Umgebung mit dem vorinstallierten Chromium und Playwright, ohne `playwright install`. — Quelle: [eigene Idee] Jede Session muss selbstständig testen können. — Nachweis: –
- ❌ **R-016** Der SessionStart-Hook installiert die Projekt-Abhängigkeiten idempotent, sobald es welche gibt. Tests laufen in jeder neuen Session sofort. — Quelle: [eigene Idee] — Nachweis: –

## Z. Arbeitsweise und Projekt-Infrastruktur
- ✅ **R-017** `CLAUDE.md` enthält Projektziel, Architektur-Überblick, alle Arbeitsregeln aus Punkt 4 des Einrichtungsauftrags und Verweise auf die Docs. Sie ist kurz und präzise. — Quelle: [EA] 1 — Nachweis: `CLAUDE.md`, Abgleich der Regeln mit `docs/AUFTRAG.md` Punkt 4 (Session 1)
- 🟡 **R-018** `docs/REQUIREMENTS.md` enthält jede Anforderung des Hauptauftrags als nummerierte, prüfbare Checkliste, gruppiert nach Bereich, mit Status. Nichts ist weggelassen, nichts zu stark gekürzt. — Quelle: [EA] 1 — Nachweis: Gerüst und Regeln stehen. Offen, weil der Hauptauftrag fehlt (Blocker oben).
- ✅ **R-019** `docs/PROGRESS.md` (erledigt, in Arbeit, nächster Schritt, bekannte Probleme), `docs/DECISIONS.md` und `docs/PLAN.md` (Phasen mit Ziel und Abnahmekriterien) sind angelegt. — Quelle: [EA] 1 — Nachweis: Dateien vorhanden, Ausgabe des Hooks zeigt PROGRESS.md (Session 1)
- 🟡 **R-020** In `.claude/settings.json` sind `superpowers@claude-plugins-official` und `frontend-design@claude-plugins-official` über `enabledPlugins` aktiviert. Die Syntax ist nach code.claude.com/docs geprüft. — Quelle: [EA] 2 — Nachweis: JSON gültig, Syntax nach settings-reference (D-001). Ausstehend: in Session 2 bestätigen, dass Skills `superpowers:*` und `frontend-design:*` verfügbar sind.
- ✅ **R-021** Kein aktives Plugin kürzt oder schreibt Gedächtnis- oder Anforderungsdateien automatisch um. — Quelle: [EA] 2 — Nachweis: Hooks von superpowers 7.0.2 geprüft (nur ein SessionStart, der Kontext einspielt). frontend-design hat keine Hooks. Der eigene Hook ist read-only (Session 1).
- 🟡 **R-022** Die Subagenten `requirements-reviewer`, `ui-reviewer` und `strategy-reviewer` liegen in `.claude/agents/` mit den geforderten Prüfaufträgen. — Quelle: [EA] 3 — Nachweis: Dateien mit gültigem Frontmatter. Ausstehend: in Session 2 bestätigen, dass sie als Agententyp aufrufbar sind.
- ✅ **R-023** Ein SessionStart-Hook in `.claude/settings.json` gibt beim Start den Stand aus PROGRESS.md und die offenen Punkte aus REQUIREMENTS.md aus. — Quelle: [EA] 3 — Nachweis: manueller Lauf `CLAUDE_PROJECT_DIR=$PWD .claude/hooks/session-start.sh` in Session 1. Die Ausgabe enthält PROGRESS-Abschnitte, den Blocker und alle ❌/🟡-Zeilen.
- 🟡 **R-024** Jeder abgeschlossene Schritt wird committet und nach `main` gepusht. Geht das nicht, wird am Session-Ende ein PR nach `main` geöffnet und der Nutzer informiert. — Quelle: [EA] 4 — Nachweis: siehe PROGRESS.md (Session 1). Dieser Punkt ist eine Daueranforderung und gilt für jede Session.
- ✅ **R-025** `docs/UI.md` legt prüfbare UI-Kriterien, Viewports und Screenshot-Konventionen für den ui-reviewer fest. — Quelle: [eigene Idee] Der ui-reviewer verlangt `docs/UI.md`, die Datei gab es aber noch nicht. — Nachweis: `docs/UI.md`
- 🟡 **R-026** Die Originaltexte der Aufträge stehen wörtlich in `docs/AUFTRAG.md`, damit beim Zerlegen nichts verloren geht. — Quelle: [eigene Idee] — Nachweis: Einrichtungsauftrag ist gesichert, Hauptauftrag fehlt.
- 🟡 **R-027** `docs/GAME.md` sammelt geprüftes Spielwissen über Pokelike (Bildschirme, Bedienelemente, Regeln, Strategie). Es dient als Grundlage für Bot und strategy-reviewer. — Quelle: [eigene Idee] — Nachweis: Hauptmenü am 2026-11-25 geprüft (headless auf Desktop und iPhone). Spielbildschirme, Regeln und Strategie sind offen (Phase 2).
