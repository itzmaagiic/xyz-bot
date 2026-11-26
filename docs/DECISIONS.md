# Entscheidungen

Format: **D-NNN – Titel** (Datum) · Entscheidung · Begründung · ggf. Folgen. Neue Entscheidungen kommen unten dazu. Überholte bleiben stehen und werden mit Verweis auf die neue Entscheidung als „ersetzt durch D-…“ markiert.

---

**D-001 – Plugins nur über `enabledPlugins`, ohne `extraKnownMarketplaces`** (2026-11-25)
- Entscheidung: `.claude/settings.json` enthält `"enabledPlugins": {"superpowers@claude-plugins-official": true, "frontend-design@claude-plugins-official": true}`. Es gibt keinen Eintrag in `extraKnownMarketplaces`.
- Begründung (code.claude.com/docs): `enabledPlugins` ist laut *settings-reference* ein „object mapping `plugin-name@marketplace-name` to a Boolean“. Den offiziellen Marktplatz `claude-plugins-official` (Repo `anthropics/claude-plugins-official`) fügt Claude Code laut *plugins/anthropic-marketplaces* „by default … for you“ hinzu, ihn zu deklarieren ist also unnötig. In Cloud-Sessions werden Marktplätze aus `extraKnownMarketplaces` ohnehin nicht hinzugefügt. Die Plugins kommen dort aus dem claude.ai-Konto (claude.ai/customize/plugins), wo der Nutzer sie bereits eingetragen hat.
- Folgen: Lokal (CLI) aktiviert die Projekt-Einstellung die Plugins, sobald dem Ordner vertraut wird. Installiert werden müssen sie einmal pro Rechner (`claude plugin install <name>@claude-plugins-official --scope project`).

**D-002 – SessionStart-Hook als abhängigkeitsfreies, read-only Bash-Skript** (2026-11-25) · *erweitert durch D-015 (Phasenfilter, Budget)*
- Entscheidung: `.claude/hooks/session-start.sh` ohne `matcher`. Er läuft also bei startup, resume, clear, compact und fork. Er gibt den Git-Stand, PROGRESS.md (von „Erledigt“ nur die 3 neuesten Einträge, ohne den wörtlichen Vorgänger-Anhang), Blocker-Zeilen (`> ⚠️`), die IDs aller ❌/🟡-Punkte je Phase und die Kurzform der aktuellen Phase aus (Stand nach D-015). Die Ausgabe ist auf 9.000 Bytes begrenzt.
- Begründung: Plain-stdout von SessionStart landet laut Doku im Kontext und wird bei 10.000 Zeichen gekappt. Auch nach `compact` soll der Stand wieder im Kontext stehen. Bash und awk gibt es überall, in der Cloud wie lokal. Der Hook ändert nichts, damit er nie Gedächtnisdateien beschädigt.
- Folgen: Kommen Abhängigkeiten dazu, ergänzt **Phase 2** eine idempotente Installation im selben Skript (R-016). *Ersetzt durch D-026: Die Installation läuft im Setup-Skript der Umgebung, der Hook bleibt read-only.*

**D-003 – Kein Safari/Xcode. Playwright + Chromium, iPhone per Geräteemulation** (2026-11-25) · ⚠️ *teilweise ersetzt durch D-011 (WebKit kommt dazu)*
- Entscheidung: Für Tests, Screenshots und echte Runs nutzen wir Playwright mit dem vorinstallierten Chromium. iPhone-Ansichten entstehen über Geräteemulation, Gerätewahl nach D-011 und `docs/UI.md`. Ursprünglich standen hier `iPhone 15 Pro` und `iPhone SE`. Das ist überholt, denn `iPhone SE` hat in Playwright 320×568.
- Begründung: Der Nutzer hat die Safari-Web-Extension und Xcode verworfen. Safari bleibt Ziel, aber nur über die iOS-App „Userscripts“ (R-014, R-034). In der Cloud ist Chromium vorinstalliert, und `playwright install` ist dort unerwünscht. pokelike.xyz lädt headless in Chromium auf Desktop und iPhone-Viewport fehlerfrei (geprüft am 2026-11-25).
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
- Entscheidung: Chromium nutzt das in der Cloud vorinstallierte Binary. Pinnt das Projekt eine andere `@playwright/test`-Version, läuft Chromium mit `executablePath: '/opt/pw-browsers/chromium'`. WebKit wird für die gepinnte Version installiert (`npx playwright install webkit`), und die fehlenden Systembibliotheken kommen über `npx playwright install-deps webkit` bzw. `apt-get` dazu. Der Schritt steht idempotent im Setup-Skript der Umgebung (R-016, D-026, ursprünglich war der SessionStart-Hook geplant). Für die iPhone-Tests gilt: `iphone` = `{...devices['iPhone 13'], viewport: {width: 390, height: 844}}`, wie im Hauptauftrag verlangt. Unverändert hat `devices['iPhone 13']` einen Viewport von 390×664 (Bildschirm 390×844). Diese realistische Safari-Fläche wird zusätzlich als `iphone-safari` geprüft (R-220). Das kleine Gerät ist `devices['iPhone SE (3rd gen)']` (375×667).
- Begründung: Der Hauptauftrag verlangt ausdrücklich WebKit mit iPhone-Emulation (R-065, R-189). Der Test am 2026-11-25 hat gezeigt: Der WebKit-Download von `cdn.playwright.dev` funktioniert in der Cloud (webkit-2359 für Playwright 1.63.0). Der Start scheiterte nur an fehlenden Bibliotheken (`libgtk-4.so.1`, `libgraphene-1.0.so.0` und weitere).
- Folgen: Phase 1 muss das Nachinstallieren der Bibliotheken belegen. Gelingt das nicht, ist das ein Blocker mit Meldung an den Nutzer. Ein Ersatz wäre nur Chromium-Emulation, die keine WebKit-Eigenheiten abdeckt.

**D-012 – Verzeichnisstruktur nach Hauptauftrag** (2026-11-25)
- Entscheidung: `src/core/{state,screens,strategy,actions,data,log}` · `src/ui/` · `src/platform/{chrome,userscript}` · `tests/unit/` · `tests/e2e/` · `tests/fixtures/{dom,state}/` (dazu `tests/fixtures/private/`, gitignored, D-013-Nachtrag) · `dist/` (eingecheckt, R-203) · `docs/screenshots/` (finale und Nachweis-Screenshots, eingecheckt) · `artifacts/` (Arbeits-Screenshots und Traces, **gitignored**) · `runs/<YYYY-MM-DD>-<run-id>/` (bereinigte Logs echter Runs, eingecheckt).
- Begründung: Die Struktur folgt HA §3 und §9. Screenshots, die als Nachweis für ✅ dienen, müssen über Sessions hinweg im Repo liegen. Arbeits-Screenshots würden nur die Historie aufblähen.

**D-013 – Spielstand des Nutzers nur bereinigt ins Repo** (2026-11-25) · *präzisiert am selben Tag nach dem Merge (D-016): Im Repo liegt nur ein anonymisiertes Run-Beispiel, der volle bereinigte Stand bleibt privat*
- Entscheidung (ursprünglich, siehe Nachtrag unten): Der hochgeladene localStorage-Export liegt als `tests/fixtures/storage/user-save-v3.8-2026-11-25.sanitized.json` im Repo. Entfernt wurden `poke_save_token`, `poke_save_token_exp`, `poke_save_owner`, `poke_username`, `poke_soul_link_live` (Spieler- und Tab-UUID), `poke_run_sync` (Fingerprint) sowie die Consent- und CMP-Schlüssel (`CMPList`, `_acceptanceState`, `_cmpRepromptHash`, `_cmpShown`, `gbc_consent`, `gdpr_encoding_modes`, `noniabvendorconsent`, `visitTimestamp`). Ein Scan danach fand keine UUIDs, E-Mails, langen Hex-Tokens, den Benutzernamen oder den Token-Wert mehr.
- Begründung: Das Repo soll öffentlich werden. Das Original enthält ein Cloud-Save-Token, das Zugriff auf den Spielstand geben könnte, und Personendaten. Die Struktur ist für StateReader-Tests sehr wertvoll (R-219). Die Upload-Datei gibt es nur in Session 1.
- Folgen: Jedes neue Fixture, Log oder Debug-Paket wird genauso bereinigt (R-148, R-210).
- Nachtrag (nach D-016): Der Vorgänger-Branch hatte die Regel R5.4 „Private Spielstände nie committen“ (`tests/fixtures/private/`, gitignored). Deshalb liegt der volle bereinigte Stand jetzt nur noch lokal unter `tests/fixtures/private/`. Eingecheckt ist nur `tests/fixtures/state/run-samples-v3.8.json` mit `poke_current_run`, `poke_parked_run:endless2`, `poke_settings` und `poke_patch_intro_seen`, ohne Konto- und Verlaufsdaten. Der Verlauf (Commit `ad723db`) enthält noch die volle bereinigte Fassung. Ob der Verlauf umgeschrieben wird, entscheidet der Nutzer (R-209, R-240).

**D-014 – Phasen neu geschnitten nach dem Hauptauftrag** (2026-11-25)
- Entscheidung: P0 Einrichtung, Übernahme und Zerlegung (abgeschlossen erst mit dem Review-Tor R-243) · P1 Aufklärung · P2 Gerüst und Build · P3 Kern mit Baseline-Run · P4 Strategie · P5 Oberfläche · P6 Härtung und E2E auf allen Zielen · P7 Lieferung. Details in `docs/PLAN.md`.
- Begründung: Der Hauptauftrag nennt selbst „Phase 1: Aufklärung (bevor Bot-Logik entsteht)“. Die Nummerierung übernimmt das. Die Reihenfolge stellt sicher, dass Infrastruktur und Kern stehen, bevor Strategie und Oberfläche darauf aufbauen. Ein früher echter Run in P3 liefert Logs für die Strategiearbeit.

**D-015 – Phasen-Tag in jeder Anforderung, der Hook filtert nach aktueller Phase** (2026-11-25) · *Reihenfolge der Ausgabe ersetzt durch D-035*
- Entscheidung: Jede R-Zeile trägt `[Pn]`. PROGRESS.md enthält die Zeile `**Aktuelle Phase:** Pn`. Der SessionStart-Hook gibt **zuerst** die Zählung und die ID-Listen aller offenen Punkte je Phase aus, damit keiner verloren geht. **Danach** folgt PROGRESS.md ohne die Details unter „Vorbefunde …“, und zuletzt kommen die offenen Punkte der aktuellen Phase in Kurzform. Am 2026-11-25 nachgeschärft, nachdem der Budget-Test bei längerer PROGRESS.md 129 abgeschnittene IDs gemeldet hatte. Abgeschnitten wird zeilenweise bei 9.000 Bytes, also nie mitten in einem UTF-8-Zeichen. Ein Test belegt das Budget je Phase (R-232).
- Begründung: Bei über 200 Anforderungen würde die vollständige Liste das Limit von 10.000 Zeichen für Hook-Ausgaben sprengen. So sieht jede Session sofort, was jetzt dran ist, und kein offener Punkt fehlt in der Ausgabe.

**D-016 – Vorgänger-Branch `claude/pokelike-bot-extension-skalzp` vollständig übernommen** (2026-11-25)
- Entscheidung: Der Branch (18 Commits vom 24./25.11., 97 Dateien) wird per Merge in `main` übernommen: Code (`src/`, gemeinsamer Kern, Chrome MV3, Userscript, Bridge, Simulator), Tests (98 Unit-Tests, E2E inkl. Live-Test), 29 DOM-Fixtures in Deutsch und Englisch, `docs/GAME_RECON.md` (live geprüft), `docs/STRATEGY.md` (Messwerte, Champion-Sieg) und README (Installation). Bei Konflikten in den Docs gilt die Gedächtnisstruktur dieser Session (R-IDs, PLAN, DECISIONS, Hook). Die Inhalte des Vorgängers bleiben dabei erhalten: GAME_RECON §1 bis §9, die alten Anforderungen als Abschnitt N in REQUIREMENTS (R-233 bis R-242), der alte Fortschritt wörtlich in PROGRESS.md. `.claude/settings.json` bleibt nach D-001, also ohne `extraKnownMarketplaces`.
- Begründung: Der Einrichtungsauftrag verlangt, Vorhandenes zuerst anzusehen und Passendes zu übernehmen. Der Branch setzt genau die Architektur des Hauptauftrags um und war geprüft grün: `tsc` 0 Fehler, `vitest` 98/98, `npm run build` für beide Ziele. Safari- oder Xcode-Teile, die man hätte löschen müssen, gab es nicht. Übersehen hatte ich den Branch zunächst, weil der lokale Klon nur `main` und den Session-Branch enthielt. Gefunden hat ihn der requirements-reviewer.
- Folgen: Phase 1 wird zur Bestandsaufnahme (PLAN.md). Der Branch bleibt auf GitHub bestehen, bis der Nutzer über das Löschen entscheidet.

**D-017 – Pokédollar: Bestätigungspflicht (Vorgänger R5.1) vor Budget-Logik (Hauptauftrag)** (2026-11-25)
- Entscheidung: Dauerhafte Pokédollar gibt der Bot nur mit ausdrücklicher Freigabe aus (R-237). Die Budget-Logik (R-136) und die EV- bzw. Vitamin-Investitionen im Tower (R-137) laufen als Vorschlag mit Bestätigung oder innerhalb eines Budgets, das der Nutzer ausdrücklich in den Einstellungen freigibt (Standard: 0, R-165). Ob Ausgaben im Shop während eines Runs dieselbe Währung nutzen, klärt Phase 1 (GAME_RECON §10.5).
- Begründung: Der Hauptauftrag verlangt Budget-Logik und sinnvolle EV-Investitionen, die frühere Regel des Nutzers verbietet Ausgaben ohne Bestätigung („nicht verhandelbar“). Beides ist so vereinbar: Ausgaben lassen sich nicht rückgängig machen, deshalb gilt die strengere Regel, bis der Nutzer etwas anderes sagt.

**D-018 – Erlaubte Aufrufe von Spielfunktionen (Vorgänger R5.2)** (2026-11-25) · *ergänzt durch D-031 (eigener Fallback-Speicher `pkbot.*`)*
- Entscheidung: Ausnahmen zu „nur über die normale Oberfläche“ (R-013, R-145) sind ausschließlich die UI-Öffner `openUsableItemModal` und `openItemEquipModal`, die nur einen Dialog öffnen, den ein Mensch ebenfalls öffnen kann, sowie `saveSettings({...getSettings(), …})` mit Whitelist nach zweistufiger Bestätigung. Hintergrund: Die Checkboxen im Einstellungsdialog haben keine IDs (GAME_RECON §3). Die zweite erlaubte Ausnahme ist die Simulation nach **D-019**: Sie setzt `seedRng` und `_pokeUidCounter` vorübergehend und stellt sie exakt wieder her (R-239). Jede weitere Ausnahme braucht einen neuen D-Eintrag.
- Begründung: Der Vorgänger hat diese Ausnahmen live gebraucht und dokumentiert. Sie ändern weder Spielstand noch Zufall, und der Hauptauftrag erlaubt das Ändern von Einstellungen nach Bestätigung (R-074).

**D-019 – Simulation mit der Kampf-Engine des Spiels, nur mit eigenen Seeds** (2026-11-25)
- Entscheidung: Die Strategie darf `runBattle` des Spiels mit tiefen Kopien und eigenen Seeds aufrufen. Danach werden `state`, RNG-Seed und `_pokeUidCounter` exakt wiederhergestellt. Den gesäten Zufall des Spiels nutzt der Bot **nie**, um echte Ergebnisse vorherzusagen (R-239).
- Begründung: Das ist der stärkste Hebel für gute Entscheidungen (STRATEGY.md: Champion-Sieg), ohne Fair Play zu verletzen. Kein Mensch kennt den echten Zufall, Verteilungen kann er aber abschätzen.

**D-020 – Selektoren: IDs, `data-*` und Spielzustand vor Text** (2026-11-25)
- Entscheidung: Die Reihenfolge ist (1) Screen-ID und Element-IDs, `data-*`, Sprite-Pfade und `state`, dann (2) Rolle und Struktur, zuletzt (3) Text, und zwar nur über sprachunabhängige Merkmale oder eine Tabelle je Sprache. Fragile, generierte oder rein optische Klassen werden nicht verwendet.
- Begründung: Der Hauptauftrag verlangt „Selektoren über Text und Rolle statt fragiler Klassen“ (R-195). Sein Ziel ist Robustheit bei Updates. Die Aufklärung zeigt aber, dass die UI in 8 Sprachen vorliegt und Texte deshalb unbrauchbar sind, während die Screen- und Element-IDs stabil sind (GAME_RECON §1). Die Entscheidung erfüllt das Ziel des Auftrags und weicht nur beim Mittel ab.

**D-021 – Prüfung von Plugins und Agententypen nach P1 verschoben** (2026-11-25)
- Entscheidung: R-020 und R-022 tragen jetzt `[P1]` statt `[P0]`.
- Begründung: Agententypen werden erst beim Sessionstart geladen, in Session 1 war `subagent_type: requirements-reviewer` noch „not found“. In der Cloud kommen die Plugins schon über den Konto-Sync, daran lässt sich die Projekt-Einstellung nicht unterscheiden. Phase 0 sollte daran nicht hängen.

**D-022 – Bereinigen der Git-Historie abgespalten und nach P7 verschoben** (2026-11-25)
- Entscheidung: R-240 gilt für den aktuellen Stand und ist erfüllt. Das Bereinigen der Historie (`c8c13a8` Autor-Gmail, `ad723db` voller bereinigter Spielstand) wird als R-244 [P7] geführt.
- Begründung: Dafür braucht es einen Rewrite mit Force-Push auf `main`. Das ist irreversibel und betrifft das öffentliche Repo, also entscheidet allein der Nutzer. Der Abschluss von Phase 0 hängt nicht daran, verbindlich ist es aber vor der Veröffentlichung.

**D-023 – Offene Nutzerentscheidungen: Nutzer hat delegiert („Entscheide du alles sinnvoll“)** (2026-11-25)
- **Pokédollar:** Die strenge Regel bleibt endgültig (R-237, D-017). Ausgaben gibt es nur mit ausdrücklicher Freigabe, das Budget steht standardmäßig auf 0 (R-165). Begründung: Ausgaben sind irreversibel, die strenge Regel stammt vom Nutzer, und lockern lässt sie sich jederzeit.
- **Git-Verlauf bereinigen (R-244):** Entschieden: **ja, vor der Veröffentlichung.** Begründung: Das Repo soll öffentlich werden, der Nutzer hat ausdrücklich nach Personendaten gefragt, und mit wenigen Commits ist ein Rewrite jetzt am billigsten. Vorbereitet und als Probelauf geprüft am 2026-11-25:
  - `git filter-repo` lief auf einem Bare-Klon mit allen drei Remote-Branches. Eine Mailmap ersetzt die private Autor-Adresse im Initial-Commit durch die noreply-Adresse von GitHub, und `--invert-paths --path tests/fixtures/storage/user-save-v3.8-2026-11-25.sanitized.json` entfernt den Spielstand.
  - Ergebnis: keine private Adresse mehr in Blobs oder Metadaten, keine Spielstand-Datei im Verlauf, der Tree von `main` ist identisch.
  - **Ausführung blockiert:** Die Sicherheitsprüfung der Cloud-Umgebung hat den Force-Push (`--force-with-lease`) abgelehnt, weil die allgemeine Delegation nicht als ausdrückliche Freigabe für einen destruktiven Push auf `main` gilt. Das wird **nicht** umgangen.
  - Nächster Schritt: Der Nutzer gibt ausdrücklich frei, etwa mit „Ja, Force-Push auf main zum Bereinigen des Verlaufs ist erlaubt, und den alten Branch darfst du löschen“. Dann wird das Vorgehen wiederholt. Gepusht werden `main` und der Session-Branch per `--force-with-lease`, gelöscht wird `claude/pokelike-bot-extension-skalzp`. Danach müssen die Commit-Hashes in den Docs per `filter-repo/commit-map` aktualisiert werden.
  - **Wichtig:** Die private Adresse darf in keiner Datei im Repo stehen, auch nicht in dieser. Die Mailmap entsteht nur temporär außerhalb des Repos.
- **Alten Branch `claude/pokelike-bot-extension-skalzp` löschen:** Entschieden: **ja, zusammen mit dem Rewrite.** Sein Inhalt steckt vollständig in `main`. Ohne Rewrite bringt das Löschen nichts, weil der Initial-Commit auch in `main` liegt. Es ist derselbe Freigabe-Schritt.
- Ergänzende Empfehlung an den Nutzer: In den GitHub-Einstellungen unter „Emails“ die Optionen „Keep my email addresses private“ und „Block command line pushes that expose my email“ aktivieren. Alte Commits bleiben auf GitHub nach einem Rewrite noch eine Weile über ihre SHA abrufbar. Wer sie vollständig entfernen will, wendet sich an den GitHub-Support.

**D-024 – Verlauf bereinigt (ausgeführt nach ausdrücklicher Freigabe des Nutzers)** (2026-11-25)
- Freigabe des Nutzers, wörtlich: „Ja, Force-Push auf main zum Bereinigen des Verlaufs ist erlaubt, und den alten Branch darfst du löschen.“ Das ist eine einmalige Ausnahme von der Regel „nie mit force“ in CLAUDE.md.
- Ausführung: Zuerst ein Backup-Bundle aller Refs (nur in der Session, nicht im Repo). Dann `git filter-repo` auf einem frischen Bare-Klon: Die Mailmap entstand temporär aus den Commit-Metadaten und wurde danach gelöscht, `--invert-paths` entfernte den Spielstand. Gepusht wurden `main` und der Session-Branch mit `--force-with-lease` auf den erwarteten alten Stand.
- Prüfung: In den neuen Branches 0 Gmail-Adressen in Blobs und Metadaten, 0 Pfade `tests/fixtures/storage/`, Tree von `main` vor und nach dem Rewrite identisch.
- Commit-Hashes haben sich geändert. Die Docs sind auf die neuen Hashes umgestellt: `6bb73a4`→`dd16965`, `d17fe64`→`a7b65cf`, `5d3f7b0`→`fd3422f`, `1ac0cec`→`07f98ec`, `007bcf6`→`ce01aac`, `5eabb60`→`8f6590d`, Initial-Commit `c8c13a8`→`3a35d3b`, Spielstand-Commit `ad723db`→`34bad56` (jetzt ohne die Datei). Ältere D-Einträge nennen die alten Hashes absichtlich, weil sie den damaligen Zustand beschreiben.
- **Nicht möglich:** Den alten Branch `claude/pokelike-bot-extension-skalzp` zu löschen, lehnt der Git-Proxy der Session mit 403 ab, eine Richtlinie, die nicht umgangen wird. Der Nutzer löscht ihn auf GitHub (Branches → Papierkorb-Symbol). Erst dann ist auch der alte Initial-Commit nicht mehr über einen Branch erreichbar (R-244).

**D-025 – Phase 1: Design freigegeben; Fairness-Sofortmaßnahmen vorgezogen; Seeds aus sichtbarem Zustand** (2026-11-25)
- Entscheidung: Das Design steht in `docs/superpowers/specs/2026-11-25-phase1-design.md`, die Reihenfolge ist Sicherheit → Messen → Aufklären → Abnehmen. Vor jedem Live-Lauf werden zwei Fixes vorgezogen. (1) Die Simulations-Seeds kommen aus einem Hash des **sichtbaren** Zustands (Karte, Knoten, Team) statt aus `getRngSeed()`, Teil von R-239/R-248. (2) Ein Actor-Guard mit Tasten-Allowlist (nur Shift+Digit1–6) und Klick-Denylist für Reset und Account, Kern von R-147. Live-Läufe gibt es nur mit frischen, nicht eingeloggten Profilen (R-228).
- Begründung: Live-Läufe sind Teil von Phase 1 (Bestandsaufnahme, Aufklärung). Sie dürfen nicht gegen Fair Play verstoßen. Echte Zufallszahlen als Seed-Basis würden zudem R-030 widersprechen, weil Entscheidungen dann nicht mehr reproduzierbar wären. Ein Hash über den sichtbaren Zustand erfüllt beides. Die Ausnahme „Phase 1 vor Bot-Logik“ gilt hier nicht, weil es Sicherheitskorrekturen an bestehendem Code sind und keine neue Logik.
- Freigabe nach D-006: eigenes Review des Designs (keine Widersprüche zu R-030, R-147, R-239, R-248, R-228). Ausführung gemischt: kleine Code-Fixes inline mit TDD, die Bestandsaufnahme über parallele requirements-reviewer.

**D-026 – Abhängigkeiten und WebKit über das Setup-Skript der Umgebung statt über den SessionStart-Hook** (2026-11-25)
- Entscheidung: Die Cloud-Umgebung „xyz-bot“ hat ein Setup-Skript: `npm ci`, `npx playwright install webkit` und `npx playwright install-deps webkit`, mit `PLAYWRIGHT_BROWSERS_PATH` als Standard `/opt/pw-browsers`. Es läuft beim Bau eines frischen Containers. Der SessionStart-Hook bleibt read-only (D-002).
- Begründung: Die apt-Installation dauert beim ersten Mal mehrere Minuten und braucht Root. Im Hook würde sie jeden Start bremsen und den Hook mit Seiteneffekten belasten. Das Setup-Skript ist dafür gedacht, und das Ergebnis wird mit dem Container gecacht. Lokal (macOS/Windows) installiert man einmal per `npx playwright install webkit`.
- Nachtrag zu D-011: WebKit läuft seit 2026-11-25 in der Cloud. E2E: 17 bestanden, 1 gewollt übersprungen (R-065).

**D-027 – Zielwert für „starke Runs“ (R-230)** (2026-11-25)
- **Baseline:** Der Vorgänger, Variante A, erreichte über 12 Runs Story Classic Kanto Ø 3,2 Orden, dazu später 1 Champion-Sieg in einer Sitzung mit 13 Runs (STRATEGY.md). In Phase 1 lief der Live-Lauf 2 (frisches Profil) über 4 Runs: 0 Siege, 3 Orden, dann ein Hänger am Kampfende (PROGRESS).
- **Ziel für P4**, Story Classic Kanto, frisches Profil, Standardprofil „Ausgewogen“, mindestens **20 Runs** am Stück:
  - Ø ≥ 5 Orden pro Run
  - Siegquote gegen den Champ ≥ 15 %, also mindestens 3 Siege
  - **0 Hänger**, d. h. keine Pause außer den gewollten (Stopp-Bedingung, unbekannter Bildschirm mit Meldung)
  - Jeder Run ist nach D-005 unter `runs/` geloggt.
- Für Nuzlocke, Battle Tower und Challenges werden die Zielwerte in P4 nach einer ersten Messung mit eigenem D-Eintrag festgelegt.
- Begründung: Das Ziel ist ehrgeizig, aber messbar. Gegenüber der Baseline bedeutet es grob +50 % bei den Orden und reproduzierbare Siege statt eines Einzelfalls. „Keine Hänger“ ist Voraussetzung für jede Messung.

**D-028 – R-020 (Plugin-Aktivierung über `.claude/settings.json`) nach P7 verschoben** (2026-11-25)
- Entscheidung: R-020 trägt jetzt `[P7]`. Der unterscheidende Nachweis gelingt nur in einer lokalen Claude-Code-Session des Nutzers (`/plugin` zeigt beide Plugins als „project“ aktiv). Das gehört in die Abnahme vor dem Release.
- Begründung: In der Cloud kommen die Plugins zusätzlich über den Konto-Sync. Damit lässt sich hier nicht unterscheiden, ob die Projekt-Einstellung wirkt (D-021). Die Syntax ist nach der offiziellen Doku geprüft (D-001), und die Funktion ist in der Cloud gegeben, das Risiko ist also gering.

**D-029 – Abschluss von Phase 1: Restlücken der Aufklärung nach P3 verschoben** (2026-11-25)
- Entscheidung: R-066, R-070, R-073, R-075, R-077 und R-224 tragen jetzt `[P3]`. Ihre Restlücken sind die Fixtures für `transition`, `win`, `stat-buff`, `endless-stage-complete`, das Kampfende bei Niederlage, Shop/Mart und echte Modals, DE/EN-Paare über catch und starter hinaus, die Wirkung jeder Spieleinstellung sowie die Version in Logs und Fixtures. Alles ist in GAME_RECON §13 festgehalten.
- Begründung: Diese Bildschirme entstehen nur in bestimmten Spielsituationen (Champion-Sieg, Tower-Stufe, Shop). Sinnvoll und nach R-224 vorgeschrieben ist es, sie genau dann aufzunehmen, wenn P3 ihre Behandlung baut: erst das Fixture, dann die Logik. Die Version in Logs hängt am neuen Log-Format (R-006, P3). Die Wirkung der Skip-Einstellungen (R-073) hängt direkt am Kampf-Handling: Der Hänger in §12.8 betrifft gesperrtes SKIP, und genau das baut P3 neu. Geklärt wird die Wirkung deshalb dort, zusammen mit dem Test. Ein Warten in P1 hätte keinen Mehrwert und würde Kern und Strategie aufhalten. Die Aufklärung für die Kernfragen (Technik, CSP, Zustand, Speicher, Items, Traits, Vitamine, Wiki, Abgleich HA §1) ist abgeschlossen und belegt.

**D-030 – Externe Quellen: in P1 bewertet, Datenübernahme in P4** (2026-11-25)
- Entscheidung: R-064 ist erfüllt, wenn jede Quelle nach Inhalt (Gegner-Teams, Items, Traits, Mechanik), Stand bzw. Version und Abgleich mit dem Spiel bewertet ist (GAME_RECON §11). Das Übernehmen konkreter Daten, z. B. Tower-Gegner aller Regionen und Item-Details, mit Quellenangabe gehört zu P4 (R-090, R-221). Dort werden auch die spoiler-gesperrten Tower-Seiten von pokelike-guide.fr gelesen.
- Begründung: Maßgeblich ist das Spiel selbst (§12, R-064). Beide Seiten hinken v3.8 hinterher (Items 165 bzw. 164 gegenüber 297 im Spiel). Daten aus dem Spielcode (`GYM_LEADERS`, `ELITE_4`, `endlessState`, Item-Pools) haben Vorrang. Externe Daten braucht es nur, wo das Spiel sie erst zur Laufzeit erzeugt.

**D-031 – Phase 2: Design freigegeben; Fallback-Speicher localStorage mit Präfix `pkbot.`** (2026-11-25)
- Entscheidung: Das Design steht in `docs/superpowers/specs/2026-11-25-phase2-design.md` (Ansatz 1: Checks als Code plus ESLint-Regeln, eingebunden in `npm test` und `npm run lint`).
  - Das Userscript nutzt nur die GM-Schnittmenge aus R-099. ~~`GM.addValueChangeListener` gibt es nur per Feature-Erkennung~~ → `GM.addValueChangeListener` wird nicht genutzt, das Userscript hat kein `onChange` (siehe Abgleich unten; korrigiert innerhalb von D-031 nach dem Gesamt-Review P2). Die Legacy-APIs `GM_*` entfallen.
  - Fehlt GM oder wirft es, weicht der Speicher auf `localStorage` unter `pkbot.<key>` aus, danach auf einen Speicher im RAM. ~~Jeder Fallback wird als Fehler vermerkt.~~ → Jeder Fallback wird vermerkt (`noteError`): ein Fehler bei jedem gescheiterten Aufruf, das Fehlen von `GM.getValue`/`GM.setValue` einmal beim Start (`gmOrNote`, seit dem Review-Tor P2).
  - `@grant` wird aus der tatsächlichen Nutzung im Bundle erzeugt und geprüft. `@updateURL`/`@downloadURL` zeigen auf GitHub raw (`main/dist/…`). Funktionieren können die Links erst, wenn `dist/` eingecheckt ist, das kommt in P7 (R-203).
  - Die Bridge wird nicht minifiziert, `target` ist `es2020`.
- Begründung für das Präfix: Der Manipulationsschutz des Spiels (`pk.storageDigest`, GAME_RECON §12.9) erfasst nur `poke_*`-Schlüssel. `pkbot.` kollidiert weder mit `poke_*` noch mit `pkrl_*` und verändert den Digest nicht. Damit ist R-102 erfüllbar, ohne gegen R-145 bzw. D-018 zu verstoßen: Das ist kein Schreiben in den Speicher **des Spiels**, sondern eigener Speicher unter eigenem Präfix auf derselben Origin, und nur der Fallback, wenn GM fehlt.
- Freigabe nach D-006: eigenes Review (keine Widersprüche zu R-099 bis R-107, R-145, R-192, R-193, R-199). Ausführung: inline mit TDD (superpowers:executing-plans), kleine Schritte, jeweils Commit und Push, am Ende das Review-Tor. Abweichung vom Standard subagent-driven-development (CLAUDE.md): Die Tasks hängen eng an denselben Dateien (`build.mjs`, `eslint.config.js`). Frische Subagenten pro Task würden den Kontext jedes Mal neu aufbauen, ohne zusätzliche Sicherheit zu bringen. Diese liefern der Gesamt-Review per superpowers:requesting-code-review und das Review-Tor mit den drei Reviewern.
- Abgleich mit der README von quoid/userscripts (abgerufen am 2026-11-25): `GM.info` braucht kein `@grant`. `GM.addValueChangeListener` und synchrone `GM_*`-Funktionen außer `GM_info`/`GM_xmlhttpRequest` bietet quoid nicht an. `onChange` ist im Userscript deshalb ein No-op.
- Nachtrag nach dem Gesamt-Review P2 (2026-11-26):
  - **Lesereihenfolge.** Eine vorhandene `pkbot.`-Kopie hat beim Lesen Vorrang vor GM. Sie existiert nur, wenn GM fehlt oder der letzte GM-Schreibvorgang scheiterte. Ein erfolgreicher GM-Schreibvorgang löscht sie. Sonst würde ein Quota-Fehler die Änderung des Nutzers nach dem Reload stillschweigend zurücksetzen (Test „a failed GM write wins over the older GM value after a reload“).
  - **Manipulationsschutz live geprüft** (`scripts/recon/pk-tamper.mjs`, frisches Profil): `pk.keyClass('pkbot.recon') === "client"` (kein Sync, kein Digest), `pk.keyClass('poke_current_run') === "server"`. `pk.extCount` und `pk.decCount` bleiben vor dem Setzen, danach und nach einem Reload bei 0, ebenso `pk.active === false`. Das Präfix `pkbot.` löst den Manipulationsschutz also nicht aus (GAME_RECON §12.9).
  - **Regeltext.** CLAUDE.md, D-018 und GAME_RECON §1 nennen diese Ausnahme jetzt ausdrücklich.

**D-032 – Bundler: esbuild (R-079)** (2026-11-25)
- Entscheidung: Beide Ziele baut **esbuild** über ein eigenes Skript `scripts/build.mjs`. Vite wird nicht genutzt.
- Begründung:
  - Wir brauchen kein Dev-Server-/HMR-Modell. Zu bauen sind drei bis vier IIFE-Bundles: Content-Skript, Bridge, Hintergrund bzw. Popup und das Userscript.
  - Die Bridge muss als **Text** ins Userscript eingebettet werden (`__BRIDGE_CODE__`). Das geht mit der esbuild-API direkt (`write: false`), in Vite nur über ein Plugin.
  - esbuild hat keine Laufzeitabhängigkeiten, baut in unter einer Sekunde und kennt `target` (es2020) für Safari ab iOS 15.
  - Den Metadaten-Block, `@grant` und die Checks (R-104, R-192, R-193) erzeugen reine Funktionen in `scripts/userscript-meta.mjs`. Ein Build-Werkzeug mit eigenem Plugin-Ökosystem bringt dafür keinen Vorteil.
- Übernommen vom Vorgänger-Branch (D-016), mit dieser Begründung jetzt festgehalten.

**D-033 – `check:docs`: ✅ nur ohne offene Lücke; sechs Zeilen bereinigt** (2026-11-25)
- Entscheidung: `npm run check:docs` (R-246) behandelt eine ✅-Zeile mit „**Lücke:**“ als Fehler. Grundlage ist die Regel in REQUIREMENTS: ✅ heißt umgesetzt **und** nachweislich getestet. Beim ersten Lauf traf das sechs Zeilen aus der Bestandsaufnahme P1. Jede wurde einzeln entschieden, die Regel wurde dafür nicht aufgeweicht:
  - **R-047, R-115, R-131 → 🟡.** Die Lücke betrifft die Anforderung selbst: fragile Erkennung des neuen Relikts, ein E2E-Test, der `state` nicht wirklich prüft, und ungetesteter Integrationspfad `decide` → `decideEquip`. Sie werden in ihrer Phase (P3 bzw. P4) geschlossen.
  - **R-048, R-242 bleiben ✅.** Die genannte Lücke (deutsche bzw. englische Fixtures) ist Gegenstand von **R-212** (P3, 🟡). Die Zeilen verweisen jetzt dorthin.
  - **R-103 bleibt ✅.** Die Lücke „automatischer Check fehlt“ ist mit R-193 in P2 Task 4 geschlossen. Der Nachweis ist ergänzt.
- Begründung: Ein Check, der Lücken nur umbenennt, wäre pro forma grün (Anti-Ziel im Phase-2-Design). Herabstufen ist ehrlich, und die Punkte bleiben in ihrer Phase sichtbar. Statusänderungen sind keine Kürzung der Anforderungen: Der Anforderungstext bleibt unverändert, ergänzt wird nur der Nachweis.

**D-034 – R-015 und R-016 nach P3 verschoben; neue Anforderung R-252 (Abnahme auf echtem iPhone)** (2026-11-25)
- Entscheidung 1: R-015 (Tests, Screenshots und Runs in der Cloud) und R-016 (Abhängigkeiten in jeder neuen Session) tragen jetzt `[P3]`. Bestätigt werden sie in der ersten **frisch gebauten** Session. Erst in einem neu aufgebauten Container zeigt sich, ob das Setup-Skript (D-026) `npm ci` und WebKit wirklich einrichtet. Diese Session wurde nur neu gestartet, nicht neu gebaut (`node_modules` stammt vom ersten Start).
- Entscheidung 2: Neue Anforderung **R-252** [P7, eigene Idee]: Der Nutzer nimmt den Bot auf einem echten iPhone mit der App Userscripts ab. Die Cloud hat kein iOS-Gerät. WebKit-Emulation, GM-Shim und die statischen Checks (ES2020-Syntax, Sperrliste von APIs nach Safari 15.0) belegen viel, aber nicht die echte Installation, das Update über `@updateURL` und die Bedienung per Touch.
- Begründung: Beide Punkte hängen an Bedingungen außerhalb dieser Session. Sie in P2 offen zu lassen, würde die Phase blockieren, ohne dass weitere Arbeit hier etwas ändert. In ihren neuen Phasen sind sie sichtbar (Hook, PLAN).

**D-035 – Review-Tor P2: Reihenfolge der Hook-Ausgabe, gedämpfte Fehleranzeige, typbewusstes Linting, Ersatznachweis iOS 15** (2026-11-26)
- **Hook-Reihenfolge (ersetzt den Teil von D-015, nach dem die Kurzform „zuletzt“ kommt):** Der Hook gibt Wichtiges zuerst aus. Die Reihenfolge:
  1. Pflichthinweis
  2. Git- und Branch-Zeilen
  3. Zählung und IDs aller offenen Punkte
  4. PROGRESS-Kopf (Stand, Phase, In Arbeit, Nächster Schritt)
  5. Kurzform der aktuellen Phase. Die Zeilenlänge passt sich an `HOOK_DETAIL_BYTES` an, durchgestrichener Alttext wird entfernt.
  6. Rest von PROGRESS, mit den Unterpunkten der drei neuesten „Erledigt“-Einträge

  Gekürzt wird nur am Ende. `scripts/check-hook-budget.sh` (auch in `npm test`) prüft für jede Phase: IDs, „Nächster Schritt“ und die Kurzform mit allen angekündigten Zeilen. Begründung: Mit der alten Reihenfolge fiel die Kurzform in jeder Phase der Kürzung zum Opfer (Review-Tor P2, Runde 1).
- **Behandelte Fehler erscheinen gedämpft (`debug`) im Bot-Log statt als Warnung.** Begründung (UI-Review P2): Orange gehört echten Problemen. Ein Fallback, der funktioniert, ist eine Information. Sichtbar bleibt er in Overlay-Log und Export (R-199). Ein Fehler, der die ganze Fallback-Kette betrifft, soll laut R-253 (P3) zur Warnung werden.
- **Typbewusstes Linting für `src/**`:** `@typescript-eslint/no-floating-promises` (`ignoreVoid: false`) und `no-misused-promises`. Jede Fire-and-forget-Promise läuft über `noteRejection(where, p)`. Begründung: Eine abgelehnte Promise ohne Handler ist ein stiller Fehler (R-199, Review-Tor P2, Runde 2). Der Aufwand ist gering, ESLint braucht dafür rund 4 s.
- **Ersatznachweis für „läuft ab Safari iOS 15“ (R-107, R-252):** Ein Lauf auf einem echten Gerät mit iOS 15.x wird angestrebt (R-252). Ist keins verfügbar, gelten als Nachweis zusammen:
  - die statischen Checks (ES2020-Parse, Sperrliste neuerer APIs, nur echte Feature-Erkennung)
  - der WebKit-E2E
  - der Gerätelauf auf der ältesten verfügbaren iOS-Version, mit Versionsangabe im Prüfprotokoll

  Begründung: iOS-15-Geräte sind selten verfügbar. Die statischen Checks decken genau die Ursachen ab, an denen ein Skript auf iOS 15 scheitert (Syntax, fehlende APIs).

**D-036 – Bedrohungsmodell der Lint-Leitplanken (R-032, R-199)** (2026-11-26)
- Zweck: Festlegen, welche Umgehungen die automatischen Checks erkennen **müssen** und welche bewusst nicht. Ohne diese Grenze ließe sich jede Review-Runde um eine weitere Umgehung verlängern (Review-Tor P2, Runden 1 bis 3).
- **Muss erkannt werden** (natürliche Muster, die beim normalen Programmieren oder durch Kopieren entstehen), jeweils mit Test:
  - **Plattform-APIs in `core/`, `ui/` und `app.ts` (R-032):**
    - Import und `import()` (auch berechnet)
    - Globale wie `chrome` und `GM`
    - Property auf jedem Objekt: `globalThis.chrome`, Cast, Alias, `document.defaultView`, `window.window`
    - `declare const GM` und andere Bezeichner mit Plattform-Namen
    - Destructuring
    - String- und Template-Keys
  - **Stille Fehler (R-199):**
    - leere oder kommentarlose catch-Blöcke
    - `.catch(() => x)` und `.catch(bezeichner)`
    - Rejection-Handler in `.then(a, b)`
    - schwebende Promises (typbewusst, auch `void p`)
    - async-Callbacks an Stellen, die `void` erwarten
    - `el.onx = async …`
    - Abschalten per `eslint-disable`: nur pro Regel und nur laut Allowlist
    - Abschalten per Inline-Konfiguration `/* eslint regel: "off" */`
- **Bewusst nicht erkannt** (vorsätzliche Umgehung, kein Versehen; fällt im Code-Review auf):
  - `Reflect.get`
  - `Object.getOwnPropertyDescriptor`
  - Strings, die zur Laufzeit zusammengebaut werden
  - `new Function`/`eval`
  - Umbenennen über Module
  - eine geänderte ESLint-Konfiguration selbst
- **Absicherung zur Laufzeit statt Lint:** Ein globaler Handler für `unhandledrejection`/`error`, der über `noteError` meldet, fängt, was Lint nicht sieht. Er kommt mit R-200 in P3.
- Folge: Eine neue Umgehung aus der ersten Liste ist ein Fehler, der Test und Fix braucht. Eine aus der zweiten Liste ist kein Fund für das Review-Tor.
- **Nachtrag Runde 4 (2026-11-26): Klassen statt Einzelmuster.** Runde 4 fand weitere Varianten derselben Klassen. Seitdem gilt:
  - **R-032, Geltungsbereich:** umgedreht auf ganz `src/` außer `platform/chrome/**`, `platform/userscript/**` und `platform/clipboard.ts`. Damit sind `platform/types.ts` und jeder neue Ordner erfasst.
  - **R-032, Plattform-Namen:** In diesen Dateien dürfen sie weder als Bezeichner noch als String- oder Template-Text vorkommen. Ausgenommen sind TS-Literal-Typen ohne Laufzeitzugriff. Damit ist jede Key-Variante gesperrt: Destructuring, `as`, `satisfies`, berechnete Keys.
  - **R-199:** Die typbewusste Regel `local/no-promise-handler` meldet jede `on*`-Zuweisung, deren Handler einen Promise zurückgibt: `async`, Pfeil oder Referenz. Sie ersetzt den Syntax-Selektor für `async`.
  - **Artefakt-Ebene:** Der Build prüft, dass im Userscript-Bundle kein `chrome.*`/`browser.*` und in den Chrome-Bundles kein `GM.*`/`GM_*` steht (`platformLeaks`). Das fängt auch das „Umbenennen über Module“ ab, das Lint bewusst nicht prüft.
  - **Verhaltenstests mit Typinformation:** `tests/unit/lint-behaviour.test.ts`, `lintText` mit vorhandenem Pfad.
  - **Bekannte Lücke:** `Promise.allSettled` mit ignorierten Ergebnissen. Das deckt der Laufzeit-Handler aus R-200 ab (P3).
- **Nachtrag Runde 5 (2026-11-26):**
  - „Jede `on*`-Zuweisung“ umfasst Handler mit Union-Typ (`… | null | undefined`, Ternär, `??`).
  - Die Import-Grenze arbeitet pfadauflösend (`local/no-adapter-import`), wirkt also aus jedem Verzeichnis gleich, auch aus `src/platform/types.ts`.
  - Unter `src/` liegen nur `.ts` und statische Assets. Das prüft ein Test.
  - `platformLeaks` prüft Tokens und überspringt die Modulpfad-Kommentare von esbuild.
  - **Ausdrücklich „bewusst nicht erkannt“:**
    - Handler-Zuweisung über berechneten Key (`b['onclick'] = …`) oder `Object.assign(b, { onclick })`
    - `const _p = work()` (das `_` schaltet `no-unused-vars` ab)

    Beides deckt der Laufzeit-Handler aus R-200 ab (P3).
  - **Folge des Literal-Verbots:** `core/` und `ui/` vergleichen nie `platform.name === 'chrome'`. Plattform-Unterschiede kommen als Fähigkeiten oder Label aus dem Adapter.
- **Nachtrag Runde 6 (2026-11-26):**
  - **Subtyp-Reduktion:** TypeScript kürzt `cond ? () => void : () => Promise<void>` (ebenso `??`, `||`) zu `() => void`. `local/no-promise-handler` typisiert deshalb jeden Zweig von `?:`, `??`, `||` und `&&` (und den letzten Ausdruck einer Sequenz) einzeln.
  - `local/no-adapter-import` bestimmt das Repo-Root aus dem eigenen Dateiort statt aus `cwd`. Damit wirkt die Regel gleich, egal ob vom Root, aus `src/` oder in einer IDE. Endungen wie `clipboard.js` sind eingeschlossen.
  - **Bekannte Lücke (P3, R-200):** Dieselbe Subtyp-Reduktion trifft `@typescript-eslint/no-misused-promises` bei `addEventListener('click', cond ? sync : async)`. Das ist eine Lücke in typescript-eslint selbst. Abgedeckt wird sie vom Laufzeit-Handler aus R-200.
  - **Vorbefund P3:** Der gemeinsame MAIN-Welt-Einstieg `bridge-main.ts` liegt in `platform/chrome/`, wird aber auch ins Userscript gebündelt. Er gehört an einen neutralen Ort. Dazu kommt eine Lint-Grenze zwischen den Adaptern (`chrome` ↔ `userscript`).
- **Abschluss (Runde 7, 2026-11-26):** Review-Tor P2 bestanden. Als bekannte Lücken bleiben, abgedeckt durch den Laufzeit-Handler aus R-200 (P3):
  - **Subtyp-Reduktion abseits der direkten Zuweisung:** `const h = on ? s : work; b.onclick = h`, `(…)!`, `(…) satisfies`, Array-Index, IIFE.
  - **Nackte globale Zuweisung** `onmessage = async …`, ohne Member links.
  - **Theoretischer Fehlalarm** bei `b.onclick = work && s` bzw. `s || work`. Er schlägt in die sichere Richtung aus.
