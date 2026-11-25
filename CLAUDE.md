# xyz-bot – Bot für Pokelike (pokelike.xyz)

## Projektziel
Ein Bot für das Browser-Roguelike **Pokelike** (https://pokelike.xyz, Pokémon-Fan-Roguelike, Stand v3.8). Er soll klug und nachvollziehbar spielen, jede Entscheidung protokollieren und eine übersichtliche Oberfläche für Desktop und iPhone haben, die keine Spielbuttons verdeckt.
Diese Beschreibung ist **vorläufig**. Sie ist aus dem Einrichtungsauftrag abgeleitet, weil der Hauptauftrag noch fehlt. Maßgeblich für den Umfang ist allein `docs/REQUIREMENTS.md`.

## Architektur (Stand: noch nicht festgelegt)
- Es gibt noch keinen Bot-Code. Plattform und Aufbau werden in Phase 2 entschieden (`docs/PLAN.md`) und danach hier und in `docs/DECISIONS.md` eingetragen.
- Fest steht: **kein Safari und kein Xcode** (D-003). Tests, Screenshots und echte Runs laufen mit **Playwright + Chromium**. In der Cloud ist beides vorinstalliert, daher **nie `playwright install`** ausführen. Das iPhone wird über Playwrights Geräteemulation (`iPhone 15 Pro`, `iPhone SE`) nachgebildet.
- pokelike.xyz ist aus der Cloud-Umgebung erreichbar und lädt headless (geprüft am 2026-11-25, siehe `docs/GAME.md`).
- Konventionen (D-004, D-005): `src/` Code · `tests/` Tests · `screenshots/` Review-Screenshots · `runs/` Logs echter Runs (JSONL, eine Zeile pro Bot-Entscheidung).

## Befehle
_Noch keine. Sobald es welche gibt, hier eintragen: Abhängigkeiten installieren, Tests, Screenshots (Desktop und iPhone), echter Run._

## Dokumente (Gedächtnis)
| Datei | Zweck |
|---|---|
| `docs/REQUIREMENTS.md` | **Einzige Quelle der Wahrheit** für den Umfang: R-IDs mit Status und Nachweis |
| `docs/PROGRESS.md` | Erledigt, in Arbeit, nächster Schritt, bekannte Probleme |
| `docs/PLAN.md` | Phasen mit Ziel und Abnahmekriterien |
| `docs/DECISIONS.md` | Entscheidungen mit Begründung (D-IDs) |
| `docs/UI.md` | UI-Qualitätskriterien. Grundlage für den `ui-reviewer` |
| `docs/GAME.md` | Spielwissen über Pokelike: Bildschirme, Regeln, Strategie |
| `docs/AUFTRAG.md` | Originaltexte der Aufträge, wörtlich. Nie umschreiben |
| `docs/superpowers/` | Specs und Pläne aus Superpowers. Sie sind abgeleitet und verweisen auf R-IDs |

Subagenten in `.claude/agents/`: **requirements-reviewer** (Anforderungen gegen Code, Tests und Screenshots), **ui-reviewer** (Screenshots nach `docs/UI.md`), **strategy-reviewer** (Bot-Entscheidungen in den Logs echter Runs).
Der SessionStart-Hook (`.claude/hooks/session-start.sh`) zeigt beim Start den Stand aus PROGRESS.md und die offenen R-Punkte an.

## Arbeitsregeln
1. **Vor jeder Aufgabe** `CLAUDE.md`, `docs/REQUIREMENTS.md` und `docs/PROGRESS.md` lesen. Die Ausgabe des Hooks ersetzt das Lesen nicht. Diese Dateien sind die **einzige Quelle der Wahrheit**. Pläne aus Superpowers beziehen sich auf sie (R-IDs) und halten sie aktuell, nicht umgekehrt.
2. **Denk wie ein anspruchsvoller Product Owner und erfahrener Pokelike-Spieler**, nicht wie jemand, der stur eine Liste abarbeitet. Frag dich bei jedem Feature: Was erwartet ein Nutzer hier? Was kann schiefgehen? Was fehlt, obwohl es nicht gesagt wurde? Sinnvolle Verbesserungen setzt du selbst um und trägst sie in REQUIREMENTS.md ein, markiert mit `[eigene Idee]`.
3. Für jede größere Aufgabe gilt der **Superpowers-Workflow**: brainstorming → writing-plans → test-driven-development → subagent-driven-development bzw. requesting-code-review → verification-before-completion. Für jede Arbeit an der Oberfläche zusätzlich **frontend-design**.
4. Ein Punkt ist erst **✅, wenn er umgesetzt UND nachweislich getestet ist** (Test oder Screenshot). Den Nachweis trägst du in der R-Zeile ein (`Nachweis: tests/…:Testname` oder `screenshots/…png`).
5. **Am Ende jeder Phase** kommt zuerst ein eigenes Review. Danach laufen alle drei Reviewer-Subagenten, parallel. Ihre Funde behebst du und prüfst erneut. Erst dann geht es weiter. Das Ergebnis kommt in PROGRESS.md.
6. **Kleine, abgeschlossene Schritte.** Nach jedem Schritt PROGRESS.md aktualisieren, committen und pushen.
7. **Git:** siehe unten. Push nach `main`, damit jede neue Session den aktuellen Stand hat.
8. **Nur fragen, wenn du wirklich blockiert bist.** Sonst entscheidest du selbst und dokumentierst die Entscheidung in DECISIONS.md.
9. **Am Ende jeder Session** eine kurze Zusammenfassung: was fertig ist, was offen ist, was als Nächstes kommt. Dieselben Punkte stehen auch in PROGRESS.md.

### Superpowers an diese Regeln angepasst (CLAUDE.md hat Vorrang, D-006)
- *brainstorming*: Die Fragen beantwortest du selbst als Product Owner, gestützt auf Auftrag, `docs/GAME.md` und Recherche. Als „Freigabe“ des Design-Docs gilt ein eigenes kritisches Review plus ein Eintrag in DECISIONS.md. Den Nutzer fragst du nur, wenn du wirklich blockiert bist.
- *writing-plans*: Pläne kommen nach `docs/superpowers/plans/`, und jede Aufgabe nennt ihre R-IDs. Die Ausführungsart erfragst du nicht. Standard ist subagent-driven-development.
- *using-git-worktrees*: Wird nicht genutzt, weil der Cloud-Container schon isoliert ist. Du arbeitest direkt auf dem Session-Branch.
- *finishing-a-development-branch*: Kein Auswahlmenü. Es gilt die Git-Regel unten.

### Gedächtnis schützen
- Anforderungen werden **nie gelöscht, gekürzt oder umnummeriert**. Ist ein Punkt überholt, streichst du ihn durch (`~~…~~`) und ergänzt Begründung und D-Verweis.
- Kein Plugin, Hook oder Tool darf Gedächtnis- oder Anforderungsdateien automatisch kürzen oder umschreiben.
- Der Hauptauftrag steht wörtlich in `docs/AUFTRAG.md`. Er wird nie paraphrasiert oder überschrieben.

### Git
- Du arbeitest auf dem Branch, den die Umgebung vorgibt. Zu Beginn der Session: `git fetch origin main && git merge --ff-only origin/main`. Geht das nicht als Fast-Forward, nimm `git merge --no-edit origin/main`.
- Nach jedem Schritt: committen, `git push -u origin <branch>` und danach `git push origin HEAD:main`, nur als Fast-Forward und **nie mit force**. Der Nutzer hat den Push nach `main` ausdrücklich und dauerhaft erlaubt (Einrichtungs-Session vom 2026-11-25). In der Cloud-Umgebung funktioniert das (getestet am 2026-11-25).
- Lehnt `main` den Push ab, weil es neuere Commits hat: `git fetch origin main && git merge --no-edit origin/main`, Tests laufen lassen, erneut pushen.
- Verbietet die Umgebung den Push nach `main` (etwa mit 403): Am Ende der Session einen Pull Request nach `main` öffnen und dem Nutzer Bescheid sagen.
