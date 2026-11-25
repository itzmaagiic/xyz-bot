# xyz-bot – Pokelike.xyz-Bot (Chrome-Erweiterung + Userscript)

## Projektziel
Ein Bot, der das Browser-Roguelike **Pokelike** (https://pokelike.xyz, Pokémon-Autobattler, Stand v3.8) selbstständig, effizient und klug spielt: starke Runs, durchdachte und protokollierte Entscheidungen statt Zufall.
Aus **einer** TypeScript-Codebasis entstehen **zwei Build-Ziele**: eine Chrome-Erweiterung (MV3, entpackt ladbar, auch für Edge, Opera und Brave) und ein Userscript (`.user.js` + `.meta.js`) für die iOS-App „Userscripts“ von quoid in Safari. Das Userscript läuft auch mit Tampermonkey und Violentmonkey. Es gibt **keine** Safari-Web-Extension und **kein** Xcode.
Bedient wird der Bot über ein Overlay auf der Spielseite (Desktop und iPhone), das keine Spielbuttons verdeckt.
Den Umfang legt allein `docs/REQUIREMENTS.md` fest. Der Auftrag steht wörtlich in `docs/AUFTRAG.md`. Einstieg für Nutzer ist `README.md`.

## Architektur (Ist-Stand aus dem Vorgänger-Branch, D-016, Zielbild nach HA §3)
- `src/core/state` (`reader.ts`, `dom-reader.ts`): liest Spielzustand und DOM, **nur lesend**.
- `src/core/screens/detector.ts`: erkennt Bildschirme über Screen-IDs (`div.screen.active`) und Modals. Bei unbekanntem Bildschirm pausiert er, er **rät nie**.
- `src/core/strategy` (`engine`, `evaluate`, `map`, `sim-route`, `items`, `choices`, `challenge`): reine Funktionen, die Gewichte liegen in `src/core/flags.ts` und `src/core/settings.ts`.
- `src/core/actions/actor.ts`: menschenähnliche Aktionen, Erfolgsprüfung, Backoff. `src/core/bot.ts` ist die Hauptschleife, `src/app.ts` verdrahtet alles.
- `src/core/bridge` (`page-bridge`, `client`, `protocol`, `simulator`): Der Spielzustand `state` ist nur im Hauptkontext sichtbar. Eine Bridge liest ihn (Chrome: `world: "MAIN"`, Userscript: script-Element plus CustomEvent). Die Simulation nutzt `runBattle` des Spiels mit eigenen Seeds und stellt den Zustand danach exakt wieder her (D-019).
- `src/core/data` (Typentabelle, Bosse), `src/core/log/logger.ts`, `src/ui/` (Overlay im Shadow DOM, Einstellungsformular, Toasts), `src/platform/{chrome,userscript}`: Adapter. **Nur hier** stehen `chrome.*` und `GM.*`.
- Spielwissen steht in `docs/GAME_RECON.md`: kein Framework, DOM, CSP ohne `script-src`, UI in 8 Sprachen, deshalb Erkennung über IDs statt Texte (D-020).
- Was davon den Hauptauftrag schon nachweislich erfüllt, klärt die Bestandsaufnahme in Phase 1.

## Unverhandelbare Regeln (Details: REQUIREMENTS H und N, D-017 bis D-020)
- **Pokédollar** (Shop, Eier, Vitamine) gibt der Bot nie ohne ausdrückliche Bestätigung des Nutzers aus (R-237).
- Kein Schreiben in den localStorage des Spiels, keine gepatchten Spielfunktionen, keine Eingriffe in Netzwerk oder Hall of Fame. Die einzigen Ausnahmen stehen in D-018 (R-145, R-238).
- „Reset Run“, Löschen und Logout klickt der Bot nie, außer der Nutzer erlaubt es ausdrücklich in den Einstellungen (R-147).
- Simulationen laufen nur mit eigenen Seeds. Echte Zufallsergebnisse sagt der Bot nie vorher (R-239).
- Unbekannter Bildschirm heißt pausieren, nie raten. Während eines Kampfes wird nie neu geladen (R-010, R-241).
- **Nie Geheimnisse oder Personendaten committen**, weder Spielstände noch Tokens (`poke_save_token`, `poke_username` …), weder in Fixtures noch in Logs, Screenshots oder Exporten. Private Spielstände gehören nur nach `tests/fixtures/private/` (gitignored, R-148, R-240). Das Repo soll öffentlich werden.

## Befehle
- `npm ci` · `npm run build` (beide Ziele) · `npm run build:chrome` · `npm run build:userscript` · `npm test` (Vitest) · `npm run e2e` · `npm run typecheck` · `npm run lint` · `npm run format`
- Live-Test gegen pokelike.xyz: `npm run e2e:live`, das baut vorher selbst. Alternativ nach `npm run build:chrome`: `LIVE=1 LIVE_MINUTES=30 LIVE_MODE=challenge LIVE_CHAL=arena npx playwright test tests/e2e/live.spec.ts --trace off`.
- Playwright: Chromium ist in der Cloud vorinstalliert (`/opt/pw-browsers`), daher **kein** `playwright install chromium`. WebKit und seine Bibliotheken folgen D-011. Die iPhone-Viewports stehen in `docs/UI.md` §1.
- Stand 2026-11-25 (Session 1): `tsc` 0 Fehler, `vitest` 98/98, `npm run build`, `lint` und `prettier --check` grün. Die E2E-Projekte für Chromium waren 12/12 grün. **`npm run e2e` ist in einer frischen Cloud-Session rot**, weil WebKit fehlt (D-011, Phase 1). `live` ist nicht gelaufen.
- Doku-Checks: `scripts/check-hook-budget.sh` (Hook-Budget, R-232).

## Dokumente (Gedächtnis)
| Datei | Zweck |
|---|---|
| `docs/REQUIREMENTS.md` | **Einzige Quelle der Wahrheit**: R-IDs mit Phase, Status und Nachweis |
| `docs/PROGRESS.md` | Aktuelle Phase, erledigt, in Arbeit, nächster Schritt, bekannte Probleme |
| `docs/PLAN.md` | Phasen P0–P7 mit Ziel, R-IDs und Abnahmekriterien |
| `docs/DECISIONS.md` | Entscheidungen mit Begründung (D-IDs) |
| `docs/AUFTRAG.md` | Originaltexte der Aufträge, wörtlich. Nie umschreiben |
| `docs/GAME_RECON.md` | Aufklärung: Bildschirme, Selektoren, Zustand, Mechanik, CSP, Version, offene Fragen |
| `docs/STRATEGY.md` | Wie und warum der Bot entscheidet, Simulation, Messwerte, A/B-Tests |
| `docs/UI.md` | Viewports, UI-Kriterien, Design-Prozess und Design-System. Grundlage für den `ui-reviewer` |
| `docs/superpowers/` | Specs und Pläne aus Superpowers. Sie sind abgeleitet und verweisen auf R-IDs |

Subagenten in `.claude/agents/`: **requirements-reviewer** (Anforderungen gegen Code, Tests und Screenshots), **ui-reviewer** (Screenshots nach `docs/UI.md`), **strategy-reviewer** (Bot-Entscheidungen in den Logs echter Runs unter `runs/`).
Der SessionStart-Hook (`.claude/hooks/session-start.sh`) zeigt beim Start PROGRESS.md, die IDs aller offenen Punkte je Phase und die offenen Punkte der aktuellen Phase in Kurzform. In großen Phasen (P3 bis P5) wird diese Kurzform gekürzt, dann die Phase in REQUIREMENTS.md vollständig lesen.

## Arbeitsregeln
1. **Vor jeder Aufgabe** `CLAUDE.md`, `docs/REQUIREMENTS.md` und `docs/PROGRESS.md` lesen. Die Ausgabe des Hooks ersetzt das Lesen nicht. Diese Dateien sind die **einzige Quelle der Wahrheit**. Pläne aus Superpowers beziehen sich auf sie (R-IDs) und halten sie aktuell, nicht umgekehrt.
2. **Denk wie ein anspruchsvoller Product Owner und erfahrener Pokelike-Spieler**, nicht wie jemand, der stur eine Liste abarbeitet. Frag dich bei jedem Feature: Was erwartet ein Nutzer hier? Was kann schiefgehen? Was fehlt, obwohl es nicht gesagt wurde? Sinnvolle Verbesserungen setzt du selbst um und trägst sie in REQUIREMENTS.md ein, markiert mit `[eigene Idee]`.
3. Für jede größere Aufgabe gilt der **Superpowers-Workflow**: brainstorming → writing-plans → test-driven-development → subagent-driven-development bzw. requesting-code-review → verification-before-completion. Für jede Arbeit an der Oberfläche zusätzlich **frontend-design**, zusammen mit dem Design-Prozess aus `docs/UI.md`.
4. Ein Punkt ist erst **✅, wenn er umgesetzt UND nachweislich getestet ist** (Test, Screenshot oder Prüfprotokoll). Den Nachweis trägst du in der R-Zeile ein.
5. **Am Ende jeder Phase** kommt zuerst ein eigenes Review. Danach laufen alle drei Reviewer-Subagenten, parallel. Ihre Funde behebst du und prüfst erneut. Erst dann geht es weiter. Das Ergebnis kommt in PROGRESS.md. Erst dann wird `**Aktuelle Phase:**` in PROGRESS.md weitergeschaltet.
6. **Kleine, abgeschlossene Schritte.** Nach jedem Schritt PROGRESS.md aktualisieren, committen und pushen.
7. **Git:** siehe unten. Push nach `main`, damit jede neue Session den aktuellen Stand hat.
8. **Nur fragen, wenn du wirklich blockiert bist.** Sonst entscheidest du selbst und dokumentierst die Entscheidung in DECISIONS.md.
9. **Am Ende jeder Session** eine kurze Zusammenfassung: was fertig ist, was offen ist, was als Nächstes kommt. Dieselben Punkte stehen auch in PROGRESS.md.
10. **Vor jedem Push** mit neuen Fixtures, Logs oder Screenshots prüfst du auf Tokens und Personendaten (siehe Unverhandelbare Regeln, R-210).

### Superpowers an diese Regeln angepasst (CLAUDE.md hat Vorrang, D-006)
- *brainstorming*: Die Fragen beantwortest du selbst als Product Owner, gestützt auf Auftrag, `docs/GAME_RECON.md` und Recherche. Als „Freigabe“ des Design-Docs gilt ein eigenes kritisches Review plus ein Eintrag in DECISIONS.md. Den Nutzer fragst du nur, wenn du wirklich blockiert bist.
- *writing-plans*: Pläne kommen nach `docs/superpowers/plans/`, und jede Aufgabe nennt ihre R-IDs. Die Ausführungsart erfragst du nicht. Standard ist subagent-driven-development.
- *using-git-worktrees*: Wird nicht genutzt, weil der Cloud-Container schon isoliert ist. Du arbeitest direkt auf dem Session-Branch.
- *finishing-a-development-branch*: Kein Auswahlmenü. Es gilt die Git-Regel unten.

### Gedächtnis schützen
- Anforderungen werden **nie gelöscht, gekürzt oder umnummeriert**. Ist ein Punkt überholt, streichst du ihn durch (`~~…~~`) und ergänzt Begründung und D-Verweis. Jede R-Zeile trägt ein Phasen-Tag `[Pn]` (D-015).
- Kein Plugin, Hook oder Tool darf Gedächtnis- oder Anforderungsdateien automatisch kürzen, zusammenfassen oder umschreiben.
- Der Auftrag steht wörtlich in `docs/AUFTRAG.md`. Er wird nie paraphrasiert oder überschrieben.

### Git
- Du arbeitest auf dem Branch, den die Umgebung vorgibt. Zu Beginn der Session: `git fetch origin main && git merge --ff-only origin/main`. Geht das nicht als Fast-Forward, nimm `git merge --no-edit origin/main`. Prüf mit `git ls-remote origin`, ob es weitere Branches mit neuer Arbeit gibt.
- Nach jedem Schritt: committen, `git push -u origin <branch>` und danach `git push origin HEAD:main`, nur als Fast-Forward und **nie mit force**. Die einzige Ausnahme war die ausdrücklich freigegebene Verlaufsbereinigung vom 2026-11-25 (D-024). Der Nutzer hat den Push nach `main` ausdrücklich und dauerhaft erlaubt (Einrichtungs-Session vom 2026-11-25). In der Cloud-Umgebung funktioniert das (getestet am 2026-11-25).
- Lehnt `main` den Push ab, weil es neuere Commits hat: `git fetch origin main && git merge --no-edit origin/main`, Tests laufen lassen, erneut pushen.
- Verbietet die Umgebung den Push nach `main` (etwa mit 403): Am Ende der Session einen Pull Request nach `main` öffnen und dem Nutzer Bescheid sagen.
