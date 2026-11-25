# xyz-bot – Pokelike.xyz-Bot (Chrome-Erweiterung + Userscript)

## Projektziel
Ein Bot, der das Browser-Roguelike **Pokelike** (https://pokelike.xyz, Pokémon-Autobattler, Stand v3.8) selbstständig, effizient und klug spielt: starke Runs, durchdachte und protokollierte Entscheidungen statt Zufall.
Aus **einer** TypeScript-Codebasis entstehen **zwei Build-Ziele**: eine Chrome-Erweiterung (MV3, entpackt ladbar) und ein Userscript (`.user.js`) für die iOS-App „Userscripts“ von quoid. Das Userscript läuft auch mit Tampermonkey und Violentmonkey. Es gibt keine Safari-Web-Extension und kein Xcode.
Bedient wird der Bot über ein Overlay auf der Spielseite, das auf Desktop und iPhone funktioniert und keine Spielbuttons verdeckt.
Den vollständigen Umfang legt allein `docs/REQUIREMENTS.md` fest. Der Auftrag steht wörtlich in `docs/AUFTRAG.md`.

## Architektur (Zielbild nach HA §3, D-012. Noch gibt es keinen Code)
- `src/core/state`: StateReader, **nur lesend** (DOM und localStorage des Spiels), liefert einen typisierten GameState.
- `src/core/screens`: ScreenDetector als Zustandsautomat. Bei unbekanntem Bildschirm pausiert er und meldet sich, er **rät niemals**.
- `src/core/strategy`: DecisionEngine aus reinen Funktionen pro Entscheidungstyp. Alle Gewichte liegen zentral in der Konfiguration.
- `src/core/actions`: Actor, der Klicks, Taps und Drag & Drop mit Pointer- und Touch-Events ausführt und danach die Wirkung prüft (Backoff, dann Pause).
- `src/core/data`: Typentabelle Gen I–VI, Pokémon-Werte und Gegner. `src/core/log`: Entscheidungs-Log als Ringpuffer und Run-Statistik.
- `src/ui/`: Overlay mit Shadow DOM. `src/platform/{chrome,userscript}`: Adapter für Speicher, Zwischenablage, Benachrichtigungen, Seitenvariablen und Tastenkürzel. **Nur hier** stehen `chrome.*` und `GM.*`.
- Gewartet wird über MutationObserver plus Stabilitätserkennung und Watchdog, nicht über feste Sleeps.
- Vorab-Befund: Der Spielzustand liegt als JSON im localStorage (`poke_current_run` mit Team und Karte). Die CSP hat kein `script-src`. Details in `docs/GAME_RECON.md`.
- **Fair Play und Datenschutz:** Der Bot spielt nur über die normale Oberfläche. Er schreibt nie in Spiel-Storage, Netzwerk oder Hall of Fame und klickt nie Reset, Löschen oder Logout. Zugangsdaten wie `poke_save_token` und `poke_username` liest, loggt und committet er **nie** (R-145 bis R-148, D-013).

## Werkzeuge und Befehle
- Node 22. Playwright: Chromium ist in der Cloud vorinstalliert (`/opt/pw-browsers`), **kein** `playwright install chromium`. WebKit plus Bibliotheken nach D-011. iPhone-Tests laufen mit `devices['iPhone 13']` (390×844, Touch).
- Geplante Skripte (Phase 2, R-201): `npm run build`, `npm run build:chrome`, `npm run build:userscript`, `npm test`, `npm run e2e`, `npm run lint`. _Sobald es sie gibt, werden sie hier bestätigt und ergänzt (Screenshots, echter Run, Secrets-Scan)._

## Dokumente (Gedächtnis)
| Datei | Zweck |
|---|---|
| `docs/REQUIREMENTS.md` | **Einzige Quelle der Wahrheit**: R-IDs mit Phase, Status und Nachweis |
| `docs/PROGRESS.md` | Aktuelle Phase, erledigt, in Arbeit, nächster Schritt, bekannte Probleme |
| `docs/PLAN.md` | Phasen P0–P7 mit Ziel, R-IDs und Abnahmekriterien |
| `docs/DECISIONS.md` | Entscheidungen mit Begründung (D-IDs) |
| `docs/AUFTRAG.md` | Originaltexte der Aufträge, wörtlich. Nie umschreiben |
| `docs/GAME_RECON.md` | Aufklärung: Bildschirme, Selektoren, Datenquellen, CSP, Version, offene Fragen |
| `docs/UI.md` | UI-Kriterien und Design-System. Grundlage für den `ui-reviewer` |
| `docs/STRATEGY.md` | Wie und warum der Bot entscheidet, ab Phase 4 |
| `docs/superpowers/` | Specs und Pläne aus Superpowers. Sie sind abgeleitet und verweisen auf R-IDs |

Subagenten in `.claude/agents/`: **requirements-reviewer** (Anforderungen gegen Code, Tests und Screenshots), **ui-reviewer** (Screenshots nach `docs/UI.md`), **strategy-reviewer** (Bot-Entscheidungen in den Logs echter Runs unter `runs/`).
Der SessionStart-Hook (`.claude/hooks/session-start.sh`) zeigt beim Start PROGRESS.md, die offenen Punkte der aktuellen Phase und die IDs aller übrigen offenen Punkte.

## Arbeitsregeln
1. **Vor jeder Aufgabe** `CLAUDE.md`, `docs/REQUIREMENTS.md` und `docs/PROGRESS.md` lesen. Die Ausgabe des Hooks ersetzt das Lesen nicht. Diese Dateien sind die **einzige Quelle der Wahrheit**. Pläne aus Superpowers beziehen sich auf sie (R-IDs) und halten sie aktuell, nicht umgekehrt.
2. **Denk wie ein anspruchsvoller Product Owner und erfahrener Pokelike-Spieler**, nicht wie jemand, der stur eine Liste abarbeitet. Frag dich bei jedem Feature: Was erwartet ein Nutzer hier? Was kann schiefgehen? Was fehlt, obwohl es nicht gesagt wurde? Sinnvolle Verbesserungen setzt du selbst um und trägst sie in REQUIREMENTS.md ein, markiert mit `[eigene Idee]`.
3. Für jede größere Aufgabe gilt der **Superpowers-Workflow**: brainstorming → writing-plans → test-driven-development → subagent-driven-development bzw. requesting-code-review → verification-before-completion. Für jede Arbeit an der Oberfläche zusätzlich **frontend-design**.
4. Ein Punkt ist erst **✅, wenn er umgesetzt UND nachweislich getestet ist** (Test oder Screenshot). Den Nachweis trägst du in der R-Zeile ein.
5. **Am Ende jeder Phase** kommt zuerst ein eigenes Review. Danach laufen alle drei Reviewer-Subagenten, parallel. Ihre Funde behebst du und prüfst erneut. Erst dann geht es weiter. Das Ergebnis kommt in PROGRESS.md. Erst dann wird `**Aktuelle Phase:**` in PROGRESS.md weitergeschaltet.
6. **Kleine, abgeschlossene Schritte.** Nach jedem Schritt PROGRESS.md aktualisieren, committen und pushen.
7. **Git:** siehe unten. Push nach `main`, damit jede neue Session den aktuellen Stand hat.
8. **Nur fragen, wenn du wirklich blockiert bist.** Sonst entscheidest du selbst und dokumentierst die Entscheidung in DECISIONS.md.
9. **Am Ende jeder Session** eine kurze Zusammenfassung: was fertig ist, was offen ist, was als Nächstes kommt. Dieselben Punkte stehen auch in PROGRESS.md.
10. **Nie Geheimnisse oder Personendaten committen**, auch nicht in Fixtures, Logs, Screenshots oder Debug-Exporten. Vor jedem Push bei neuen Fixtures, Logs oder Screenshots kurz prüfen (D-013, R-210). Das Repo soll öffentlich werden.

### Superpowers an diese Regeln angepasst (CLAUDE.md hat Vorrang, D-006)
- *brainstorming*: Die Fragen beantwortest du selbst als Product Owner, gestützt auf Auftrag, `docs/GAME_RECON.md` und Recherche. Als „Freigabe“ des Design-Docs gilt ein eigenes kritisches Review plus ein Eintrag in DECISIONS.md. Den Nutzer fragst du nur, wenn du wirklich blockiert bist.
- *writing-plans*: Pläne kommen nach `docs/superpowers/plans/`, und jede Aufgabe nennt ihre R-IDs. Die Ausführungsart erfragst du nicht. Standard ist subagent-driven-development.
- *using-git-worktrees*: Wird nicht genutzt, weil der Cloud-Container schon isoliert ist. Du arbeitest direkt auf dem Session-Branch.
- *finishing-a-development-branch*: Kein Auswahlmenü. Es gilt die Git-Regel unten.

### Gedächtnis schützen
- Anforderungen werden **nie gelöscht, gekürzt oder umnummeriert**. Ist ein Punkt überholt, streichst du ihn durch (`~~…~~`) und ergänzt Begründung und D-Verweis. Jede R-Zeile trägt ein Phasen-Tag `[Pn]` (D-015).
- Kein Plugin, Hook oder Tool darf Gedächtnis- oder Anforderungsdateien automatisch kürzen oder umschreiben.
- Der Auftrag steht wörtlich in `docs/AUFTRAG.md`. Er wird nie paraphrasiert oder überschrieben.

### Git
- Du arbeitest auf dem Branch, den die Umgebung vorgibt. Zu Beginn der Session: `git fetch origin main && git merge --ff-only origin/main`. Geht das nicht als Fast-Forward, nimm `git merge --no-edit origin/main`.
- Nach jedem Schritt: committen, `git push -u origin <branch>` und danach `git push origin HEAD:main`, nur als Fast-Forward und **nie mit force**. Der Nutzer hat den Push nach `main` ausdrücklich und dauerhaft erlaubt (Einrichtungs-Session vom 2026-11-25). In der Cloud-Umgebung funktioniert das (getestet am 2026-11-25).
- Lehnt `main` den Push ab, weil es neuere Commits hat: `git fetch origin main && git merge --no-edit origin/main`, Tests laufen lassen, erneut pushen.
- Verbietet die Umgebung den Push nach `main` (etwa mit 403): Am Ende der Session einen Pull Request nach `main` öffnen und dem Nutzer Bescheid sagen.
