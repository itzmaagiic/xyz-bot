# Aufträge (Originaltexte, wörtlich)

Diese Datei bewahrt die Aufträge des Nutzers **wörtlich** auf, damit beim Zerlegen in Anforderungen nichts verloren geht.
Regeln: Hier wird nie paraphrasiert, gekürzt oder überschrieben. Neue Aufträge oder Ergänzungen hängst du mit Datum als eigenen Abschnitt unten an.
Jeder Satz des Hauptauftrags muss in `docs/REQUIREMENTS.md` mindestens einer R-ID zugeordnet sein.

---

## Hauptauftrag

> ⚠️ **Noch nicht vorhanden.** In der Einrichtungs-Session vom 2026-11-25 stand nach „HAUPTAUFTRAG:“ kein Text.
> Sobald der Nutzer den Hauptauftrag schickt, kommt er hier **unverändert** hin. Danach wird er in `docs/REQUIREMENTS.md` vollständig zerlegt (Phase 1 in `docs/PLAN.md`).

---

## Einrichtungsauftrag (Session 1, 2026-11-25)

Das ist die Einrichtungs-Session für mein Projekt. Programmiere in dieser Session noch keinen Bot-Code. Richte nur alles so ein, dass jede spätere Session gründlich, selbstständig und ohne Vergessen arbeitet. Der eigentliche Auftrag steht unten unter „HAUPTAUFTRAG“.

Falls im Repo schon Code oder Notizen liegen: Sieh dir zuerst alles an. Übernimm, was zum Hauptauftrag passt, und lösche nur, was nicht mehr gebraucht wird (z. B. alles für Safari/Xcode). Sag mir kurz, was du übernimmst und was du verwirfst.

1. Gedächtnis-Dateien anlegen
- CLAUDE.md (wird in jeder Session automatisch geladen): Projektziel in wenigen Sätzen, Architektur-Überblick, die Arbeitsregeln aus Punkt 4, Verweise auf die Docs. Kurz und präzise.
- docs/REQUIREMENTS.md: JEDE Anforderung aus dem Hauptauftrag als nummerierte, prüfbare Checkliste (R-001, R-002 …), gruppiert nach Bereich, jeweils mit Status: ✅ erledigt und getestet, 🟡 teilweise, ❌ offen. Nichts weglassen und nichts so stark kürzen, dass Details verloren gehen. Eigene sinnvolle Ergänzungen markierst du mit [eigene Idee].
- docs/PROGRESS.md: erledigt, in Arbeit, nächster Schritt, bekannte Probleme.
- docs/DECISIONS.md: wichtige Entscheidungen mit kurzer Begründung.
- docs/PLAN.md: Phasen mit Ziel und Abnahmekriterien.

2. Plugins
Ich habe beide Plugins unter claude.ai/customize/plugins zu meinem Konto hinzugefügt. Trag sie zusätzlich in .claude/settings.json des Repos ein, damit sie für dieses Projekt aktiv sind. Prüf die genaue Syntax (enabledPlugins und ggf. extraKnownMarketplaces) vorher in der offiziellen Doku auf code.claude.com/docs.
- superpowers@claude-plugins-official
- frontend-design@claude-plugins-official
Kein Plugin, das Gedächtnis- oder Anforderungsdateien automatisch kürzt oder umschreibt.

3. Subagenten in .claude/agents/ und ein Hook
- requirements-reviewer: prüft streng jeden Punkt in REQUIREMENTS.md gegen Code, Tests und Screenshots. Kein ✅ ohne Nachweis. Listet alles Fehlende und Halbe auf.
- ui-reviewer: bewertet die Playwright-Screenshots (Desktop und iPhone) kritisch nach docs/UI.md: Übersicht, Hierarchie, Lesbarkeit, Abstände, Daumen-Bedienung, verdeckte Spielbuttons. Liefert eine priorisierte Mängelliste.
- strategy-reviewer: prüft die Bot-Entscheidungen anhand der Logs echter Runs und sucht dumme oder riskante Entscheidungen.
- SessionStart-Hook in .claude/settings.json: gibt beim Start den Stand aus PROGRESS.md und die offenen Punkte aus REQUIREMENTS.md aus.

4. Arbeitsregeln (in CLAUDE.md übernehmen)
- Vor jeder Aufgabe CLAUDE.md, REQUIREMENTS.md und PROGRESS.md lesen. Diese Dateien sind die einzige Quelle der Wahrheit. Pläne aus Superpowers beziehen sich darauf und halten sie aktuell.
- Denk wie ein anspruchsvoller Product Owner und erfahrener Pokelike-Spieler, nicht wie jemand, der stur eine Liste abarbeitet. Frag dich bei jedem Feature: Was erwartet ein Nutzer hier? Was kann schiefgehen? Was fehlt, obwohl es nicht gesagt wurde? Setz sinnvolle Verbesserungen selbst um und trag sie in REQUIREMENTS.md ein.
- Nutze den Superpowers-Workflow (Brainstorming, Plan, TDD, Subagent-Reviews) für jede größere Aufgabe und frontend-design für jede Arbeit an der Oberfläche.
- Ein Punkt ist erst ✅, wenn er umgesetzt UND nachweislich getestet ist (Test oder Screenshot).
- Am Ende jeder Phase: erst ein eigenes Review, dann alle drei Reviewer-Subagenten. Behebe die Funde, bevor du weitermachst.
- Kleine, abgeschlossene Schritte. Nach jedem Schritt PROGRESS.md aktualisieren, committen und pushen.
- Git: Push nach main, damit jede neue Session den aktuellen Stand hat. Ist das in dieser Umgebung nicht erlaubt, öffne am Ende der Session einen Pull Request nach main und sag mir Bescheid.
- Frag mich nur, wenn du wirklich blockiert bist. Sonst entscheide sinnvoll und dokumentiere die Entscheidung in DECISIONS.md.
- Am Ende jeder Session: kurze Zusammenfassung, was fertig ist, was offen ist und was als Nächstes kommt.

5. Abschluss
Committe und pushe alles. Sag mir dann: was angelegt wurde, welche Plugins ab der nächsten Session aktiv sind und welche Phasen in PLAN.md stehen.

HAUPTAUFTRAG:
_(leer)_
