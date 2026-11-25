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

**D-003 – Kein Safari/Xcode. Playwright + Chromium, iPhone per Geräteemulation** (2026-11-25) · ⚠️ *teilweise ersetzt durch D-011 (WebKit kommt dazu)*
- Entscheidung: Für Tests, Screenshots und echte Runs nutzen wir Playwright mit dem vorinstallierten Chromium. iPhone-Ansichten entstehen über `devices['iPhone 15 Pro']` und `devices['iPhone SE']`.
- Begründung: Der Nutzer hat Safari und Xcode verworfen. In der Cloud ist Chromium vorinstalliert, und `playwright install` ist dort unerwünscht. pokelike.xyz lädt headless in Chromium auf Desktop und iPhone-Viewport fehlerfrei (geprüft am 2026-11-25).
- Folgen: Die Emulation bildet Viewport, DPR, Touch und User-Agent ab, aber nicht die Eigenheiten der WebKit-Engine. Echte Safari-Besonderheiten bleiben ein Restrisiko (siehe PROGRESS.md, bekannte Probleme).

**D-004 – Verzeichnis-Konventionen (vorläufig)** (2026-11-25) · ⚠️ *ersetzt durch D-012*
- Entscheidung: `src/` Code · `tests/` Tests · `screenshots/<bereich>/<zustand>--<desktop|iphone|iphone-se>.png` · `runs/<YYYY-MM-DD>-<run-id>/` mit `decisions.jsonl`, `summary.json` und Screenshots bei Auffälligkeiten.
- Begründung: ui-reviewer und strategy-reviewer brauchen feste Fundorte. Kann in Phase 2 angepasst werden, dann ist auch die Agent-Beschreibung zu ändern.

**D-005 – Format der Run-Logs (vorläufig, Ablage nach D-012)** (2026-11-25)
- Entscheidung: `decisions.jsonl` mit einer Zeile pro Entscheidung und den Feldern `ts`, `run_id`, `step`, `game_version`, `screen`, `state` (kompakte Zusammenfassung: Team mit HP, Level, Typen; Items; Gegner; Map-Position), `options` (alle verfügbaren Optionen), `scores` (Bewertung je Option, aufgeschlüsselt nach Faktoren), `chosen`, `reason` (Begründung in Klartext), `confidence`, `profile`, `mode` und `outcome` (falls bekannt). Ergänzt am 2026-11-25 um `scores`, `profile` und `mode`, weil HA §3 „Bewertungen“ verlangt. Bereinigt nach R-148. Im Bot liegen die Logs als Ringpuffer (R-091). Echte Runs aus E2E-Tests werden nach `runs/` exportiert. Dazu `summary.json` je Run (R-009).
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

**D-009 – Hauptauftrag fehlte: Gerüst statt erfundener Anforderungen** (2026-11-25) · ✔️ *erledigt: Der Hauptauftrag wurde in derselben Session nachgereicht und zerlegt (D-014)*
- Entscheidung: REQUIREMENTS.md enthält nur Anforderungen, die sich aus dem Einrichtungsauftrag ableiten lassen, dazu klar markierte `[eigene Idee]`-Punkte und einen Blocker-Hinweis. PLAN.md-Phasen ab Phase 2 sind vorläufig.
- Begründung: Erfundene Produktanforderungen würden spätere Sessions in die falsche Richtung lenken und als „Wahrheit“ gelten. Der Nutzer muss den Hauptauftrag nachreichen.

**D-010 – Format von REQUIREMENTS.md: eine Zeile pro Anforderung mit Status-Emoji vorn** (2026-11-25) · *erweitert durch D-015 (Phasen-Tag)*
- Entscheidung: `- <✅|🟡|❌> **R-NNN** Text — Quelle — Nachweis`. IDs werden nie umnummeriert, nichts wird gelöscht.
- Begründung: Der Hook und die Reviewer können die Zeilen maschinell finden und zählen. Stabile IDs halten Verweise in Plänen, Tests und Commits gültig.

**D-011 – E2E mit Chromium UND WebKit, WebKit über die Playwright-Version des Projekts** (2026-11-25)
- Entscheidung: Chromium nutzt das in der Cloud vorinstallierte Binary. Pinnt das Projekt eine andere `@playwright/test`-Version, läuft Chromium mit `executablePath: '/opt/pw-browsers/chromium'`. WebKit wird für die gepinnte Version installiert (`npx playwright install webkit`), und die fehlenden Systembibliotheken kommen über `npx playwright install-deps webkit` bzw. `apt-get` dazu. Der Schritt steht idempotent im SessionStart-Hook (R-016). Das Gerät für die iPhone-Tests ist `devices['iPhone 13']` (390×844, Touch), wie im Hauptauftrag verlangt.
- Begründung: Der Hauptauftrag verlangt ausdrücklich WebKit mit iPhone-Emulation (R-065, R-189). Der Test am 2026-11-25 hat gezeigt: Der WebKit-Download von `cdn.playwright.dev` funktioniert in der Cloud (webkit-2359 für Playwright 1.63.0). Der Start scheiterte nur an fehlenden Bibliotheken (`libgtk-4.so.1`, `libgraphene-1.0.so.0` und weitere).
- Folgen: Phase 1 muss das Nachinstallieren der Bibliotheken belegen. Gelingt das nicht, ist das ein Blocker mit Meldung an den Nutzer. Ein Ersatz wäre nur Chromium-Emulation, die keine WebKit-Eigenheiten abdeckt.

**D-012 – Verzeichnisstruktur nach Hauptauftrag** (2026-11-25)
- Entscheidung: `src/core/{state,screens,strategy,actions,data,log}` · `src/ui/` · `src/platform/{chrome,userscript}` · `tests/unit/` · `tests/e2e/` · `tests/fixtures/{dom,storage}/` · `dist/` (eingecheckt, R-203) · `docs/screenshots/` (finale und Nachweis-Screenshots, eingecheckt) · `artifacts/` (Arbeits-Screenshots und Traces, **gitignored**) · `runs/<YYYY-MM-DD>-<run-id>/` (bereinigte Logs echter Runs, eingecheckt).
- Begründung: Die Struktur folgt HA §3 und §9. Screenshots, die als Nachweis für ✅ dienen, müssen über Sessions hinweg im Repo liegen. Arbeits-Screenshots würden nur die Historie aufblähen.

**D-013 – Spielstand des Nutzers nur bereinigt ins Repo** (2026-11-25)
- Entscheidung: Der hochgeladene localStorage-Export liegt als `tests/fixtures/storage/user-save-v3.8-2026-11-25.sanitized.json` im Repo. Entfernt wurden `poke_save_token`, `poke_save_token_exp`, `poke_save_owner`, `poke_username`, `poke_soul_link_live` (Spieler- und Tab-UUID), `poke_run_sync` (Fingerprint) sowie die Consent- und CMP-Schlüssel (`CMPList`, `_acceptanceState`, `_cmpRepromptHash`, `_cmpShown`, `gbc_consent`, `gdpr_encoding_modes`, `noniabvendorconsent`, `visitTimestamp`). Ein Scan danach fand keine UUIDs, E-Mails, langen Hex-Tokens, den Benutzernamen oder den Token-Wert mehr.
- Begründung: Das Repo soll öffentlich werden. Das Original enthält ein Cloud-Save-Token, das Zugriff auf den Spielstand geben könnte, und Personendaten. Die Struktur ist für StateReader-Tests sehr wertvoll (R-219). Die Upload-Datei gibt es nur in Session 1.
- Folgen: Jedes neue Fixture, Log oder Debug-Paket wird genauso bereinigt (R-148, R-210).

**D-014 – Phasen neu geschnitten nach dem Hauptauftrag** (2026-11-25)
- Entscheidung: P0 Einrichtung und Zerlegung (erledigt) · P1 Aufklärung · P2 Gerüst und Build · P3 Kern mit Baseline-Run · P4 Strategie · P5 Oberfläche · P6 Härtung und E2E auf allen Zielen · P7 Lieferung. Details in `docs/PLAN.md`.
- Begründung: Der Hauptauftrag nennt selbst „Phase 1: Aufklärung (bevor Bot-Logik entsteht)“. Die Nummerierung übernimmt das. Die Reihenfolge stellt sicher, dass Infrastruktur und Kern stehen, bevor Strategie und Oberfläche darauf aufbauen. Ein früher echter Run in P3 liefert Logs für die Strategiearbeit.

**D-015 – Phasen-Tag in jeder Anforderung, der Hook filtert nach aktueller Phase** (2026-11-25)
- Entscheidung: Jede R-Zeile trägt `[Pn]`. PROGRESS.md enthält die Zeile `**Aktuelle Phase:** Pn`. Der SessionStart-Hook zeigt die offenen Punkte der aktuellen Phase in Kurzform und alle übrigen offenen Punkte nur als ID-Liste je Phase.
- Begründung: Bei über 200 Anforderungen würde die vollständige Liste das Limit von 10.000 Zeichen für Hook-Ausgaben sprengen. So sieht jede Session sofort, was jetzt dran ist, und kein offener Punkt fehlt in der Ausgabe.
