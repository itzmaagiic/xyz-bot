# Entscheidungen

Format: **D-NNN – Titel** (Datum) · Entscheidung · Begründung · ggf. Folgen. Neue Entscheidungen kommen unten dazu. Überholte bleiben stehen und werden mit Verweis auf die neue Entscheidung als „ersetzt durch D-…“ markiert.

---

**D-001 – Plugins nur über `enabledPlugins`, ohne `extraKnownMarketplaces`** (2026-11-25)
- Entscheidung: `.claude/settings.json` enthält `"enabledPlugins": {"superpowers@claude-plugins-official": true, "frontend-design@claude-plugins-official": true}`. Es gibt keinen Eintrag in `extraKnownMarketplaces`.
- Begründung (code.claude.com/docs): `enabledPlugins` ist laut *settings-reference* ein „object mapping `plugin-name@marketplace-name` to a Boolean“. Den offiziellen Marktplatz `claude-plugins-official` (Repo `anthropics/claude-plugins-official`) fügt Claude Code laut *plugins/anthropic-marketplaces* „by default … for you“ hinzu, ihn zu deklarieren ist also unnötig. In Cloud-Sessions werden Marktplätze aus `extraKnownMarketplaces` ohnehin nicht hinzugefügt. Die Plugins kommen dort aus dem claude.ai-Konto (claude.ai/customize/plugins), wo der Nutzer sie bereits eingetragen hat.
- Folgen: Lokal (CLI) aktiviert die Projekt-Einstellung die Plugins, sobald dem Ordner vertraut wird. Installiert werden müssen sie einmal pro Rechner (`claude plugin install <name>@claude-plugins-official --scope project`).

**D-002 – SessionStart-Hook als abhängigkeitsfreies, read-only Bash-Skript** (2026-11-25)
- Entscheidung: `.claude/hooks/session-start.sh` ohne `matcher`. Er läuft also bei startup, resume, clear, compact und fork. Er gibt den Git-Stand, PROGRESS.md (von „Erledigt“ nur die 5 neuesten Einträge), Blocker-Zeilen (`> ⚠️`) und alle ❌/🟡-Zeilen aus REQUIREMENTS.md samt Bereich aus. Die Ausgabe ist auf 9.000 Zeichen begrenzt.
- Begründung: Plain-stdout von SessionStart landet laut Doku im Kontext und wird bei 10.000 Zeichen gekappt. Auch nach `compact` soll der Stand wieder im Kontext stehen. Bash und awk gibt es überall, in der Cloud wie lokal. Der Hook ändert nichts, damit er nie Gedächtnisdateien beschädigt.
- Folgen: Kommen Abhängigkeiten dazu, ergänzt Phase 3 eine idempotente Installation im selben Skript (R-016).

**D-003 – Kein Safari/Xcode. Playwright + Chromium, iPhone per Geräteemulation** (2026-11-25)
- Entscheidung: Für Tests, Screenshots und echte Runs nutzen wir Playwright mit dem vorinstallierten Chromium. iPhone-Ansichten entstehen über `devices['iPhone 15 Pro']` und `devices['iPhone SE']`.
- Begründung: Der Nutzer hat Safari und Xcode verworfen. In der Cloud ist Chromium vorinstalliert, und `playwright install` ist dort unerwünscht. pokelike.xyz lädt headless in Chromium auf Desktop und iPhone-Viewport fehlerfrei (geprüft am 2026-11-25).
- Folgen: Die Emulation bildet Viewport, DPR, Touch und User-Agent ab, aber nicht die Eigenheiten der WebKit-Engine. Echte Safari-Besonderheiten bleiben ein Restrisiko (siehe PROGRESS.md, bekannte Probleme).

**D-004 – Verzeichnis-Konventionen (vorläufig)** (2026-11-25)
- Entscheidung: `src/` Code · `tests/` Tests · `screenshots/<bereich>/<zustand>--<desktop|iphone|iphone-se>.png` · `runs/<YYYY-MM-DD>-<run-id>/` mit `decisions.jsonl`, `summary.json` und Screenshots bei Auffälligkeiten.
- Begründung: ui-reviewer und strategy-reviewer brauchen feste Fundorte. Kann in Phase 2 angepasst werden, dann ist auch die Agent-Beschreibung zu ändern.

**D-005 – Format der Run-Logs (vorläufig)** (2026-11-25)
- Entscheidung: `decisions.jsonl` mit einer Zeile pro Entscheidung und den Feldern `ts`, `run_id`, `step`, `game_version`, `screen`, `state` (kompakte Zusammenfassung: Team mit HP, Level, Typen; Items; Gegner; Map-Position), `options` (alle verfügbaren Optionen), `chosen`, `reason` (Begründung in Klartext), `confidence` und `outcome` (falls bekannt). Dazu `summary.json` je Run (R-009).
- Begründung: Der strategy-reviewer kann eine Entscheidung nur bewerten, wenn die Alternativen und die Begründung zum Zeitpunkt der Entscheidung bekannt sind.

**D-006 – Superpowers-Workflow an die Projektregeln angepasst** (2026-11-25)
- Entscheidung: Brainstorming-Fragen beantwortet Claude selbst als Product Owner. Als Design-Freigabe gelten eigenes Review plus ein DECISIONS-Eintrag. Pläne nennen R-IDs. Die Ausführung erfolgt per subagent-driven-development, ohne Rückfrage. Keine Git-Worktrees. Statt des Menüs aus finishing-a-development-branch gilt die Git-Regel aus CLAUDE.md.
- Begründung: Der Nutzer will nur bei echter Blockade gefragt werden. Die Nutzeranweisungen in CLAUDE.md haben laut Superpowers selbst Vorrang vor den Skills. Der Cloud-Container ist ohnehin isoliert.

**D-007 – Reviewer-Subagenten sind read-only und nutzen das Session-Modell** (2026-11-25)
- Entscheidung: Die drei Reviewer bekommen nur `Read, Grep, Glob, Bash` (kein Edit/Write) und `model: inherit`. Hilfsskripte schreiben sie nur in temporäre Verzeichnisse.
- Begründung: Reviewer sollen Mängel finden, nicht still beheben. Die Hauptsession behebt und dokumentiert. Strenge Prüfung braucht das stärkste verfügbare Modell.

**D-008 – Git: Session-Branch plus Fast-Forward-Push nach `main`** (2026-11-25)
- Entscheidung: Gearbeitet wird auf dem von der Umgebung vorgegebenen Branch. Nach jedem Schritt wird dieser Branch gepusht und zusätzlich `git push origin HEAD:main` ausgeführt (nur Fast-Forward, nie force). Geht das nicht, gibt es am Session-Ende einen PR nach `main`.
- Begründung: So hat jede neue Session den aktuellen Stand auf `main`. Der Nutzer hat den Push nach `main` ausdrücklich erlaubt. Die Cloud-Umgebung gibt pro Session einen eigenen Branch vor.

**D-009 – Hauptauftrag fehlte: Gerüst statt erfundener Anforderungen** (2026-11-25)
- Entscheidung: REQUIREMENTS.md enthält nur Anforderungen, die sich aus dem Einrichtungsauftrag ableiten lassen, dazu klar markierte `[eigene Idee]`-Punkte und einen Blocker-Hinweis. PLAN.md-Phasen ab Phase 2 sind vorläufig.
- Begründung: Erfundene Produktanforderungen würden spätere Sessions in die falsche Richtung lenken und als „Wahrheit“ gelten. Der Nutzer muss den Hauptauftrag nachreichen.

**D-010 – Format von REQUIREMENTS.md: eine Zeile pro Anforderung mit Status-Emoji vorn** (2026-11-25)
- Entscheidung: `- <✅|🟡|❌> **R-NNN** Text — Quelle — Nachweis`. IDs werden nie umnummeriert, nichts wird gelöscht.
- Begründung: Der Hook und die Reviewer können die Zeilen maschinell finden und zählen. Stabile IDs halten Verweise in Plänen, Tests und Commits gültig.
