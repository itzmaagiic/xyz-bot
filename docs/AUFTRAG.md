# Aufträge (Originaltexte, wörtlich)

Diese Datei bewahrt die Aufträge des Nutzers **wörtlich** auf, damit beim Zerlegen in Anforderungen nichts verloren geht.
Regeln: Hier wird nie paraphrasiert, gekürzt oder überschrieben. Neue Aufträge oder Ergänzungen hängst du mit Datum als eigenen Abschnitt unten an.
Jeder Satz des Hauptauftrags muss in `docs/REQUIREMENTS.md` mindestens einer R-ID zugeordnet sein.

---

## Hauptauftrag

_Nachgereicht in der Einrichtungs-Session am 2026-11-25. Der Text steht unverändert hier. Als Anhang lag ein Spielstand bei (`pokelike-save.json.txt`, localStorage-Export). Eine bereinigte Kopie lag zunächst unter `tests/fixtures/storage/` (D-013). Nachtrag vom selben Tag: Nach D-016 und D-013 ist im Repo nur noch ein anonymisiertes Run-Beispiel unter `tests/fixtures/state/`, der volle bereinigte Stand liegt privat unter `tests/fixtures/private/` (gitignored)._

# Pokelike.xyz-Bot – Chrome-Erweiterung + Userscript

## Ziel
Ein Bot, der das Browserspiel https://pokelike.xyz selbstständig, effizient und klug spielt: starke Runs, Aufmerksamkeit für jede Kleinigkeit, durchdachte Entscheidungen statt Zufall. Zwei Build-Ziele aus EINER Codebasis:
1. Chrome-Erweiterung (Manifest V3, entpackt ladbar)
2. Userscript (eine .user.js) für die iOS-App „Userscripts“ von quoid in Safari, kompatibel auch mit Tampermonkey und Violentmonkey
Keine Safari-Web-Extension, kein Xcode.

## 1. Was über das Spiel bekannt ist (live prüfen, nicht blind übernehmen)
- Pokelike ist ein fan-gemachter Pokémon-Roguelike-Autobattler im Browser. Die Kämpfe laufen automatisch. Gewonnen wird über die Entscheidungen VOR dem Kampf.
- Modi: Story (Classic oder Nuzlocke, Regionen wie Kanto/Johto/Hoenn mit Arenen, Top 4 und Champ), Battle Tower (regionale Stufen, Start mit freigeschalteten Pokémon, Typ-Boni/Traits, Normal/Hardcore, Stage Select), Challenges, Daily Pokésort (Tagesrätsel: 6 Pokémon so ordnen, dass jede Verbindung passt). Multiplayer ist „Coming Soon“, also ignorieren.
- Ablauf eines Runs: Charakter wählen → Starter wählen → Karte aus Knoten mit Routenentscheidungen (Kampf, Trainer, Arena, Shop/Pokémart, Item, Event „?“, Tausch usw.) → Orden → „Next Map →“ → Top 4 → Champ bzw. Game Over.
- Bekannte Bildschirme und Buttons: „Wild Pokémon Appeared“ (kämpfen/fangen oder fliehen), „Item Found“ (ein Item wählen oder überspringen), „Relic“ (eins wählen, bleibt für den ganzen Run), „Team Full“ (ersetzen oder behalten), „Trade Offer“ (annehmen/ablehnen), „Badge Earned“, „Choose Your Order“ (Reihenfolge per Drag & Drop), „FIGHT!“, Game Over (Play Again / Main Menu), Champion (Play Again / Share / Climb the Tower / Home), dazu Entwicklungen, Shop/Pokémart und Resume-Buttons.
- Mechaniken laut Community: Der erste lebende Pokémon im Team kämpft zuerst, die Reihenfolge ist also entscheidend. Gehaltene Items können Angriffstyp und Wirkung verändern. Typ-Boni/Traits: Pro Trait-Stufe braucht es 2 Punkte, normale Pokémon geben 1 Punkt pro Typ, Shinys 2. Level und Sonderbonbons beleben besiegte Pokémon NICHT wieder. Im Nuzlocke gilt: ein Fang pro Zone, Besiegte sind für immer weg. Im Battle Tower gibt es dauerhafte EV-Upgrades (Vitamine) für Pokédollar.
- Quellen für Gegner-Teams, Items und Traits: pokelike.wiki (z. B. /battle-tower/, /guides/kanto/, /traits/, /items/) und pokelike-guide.fr. Behandle sie als Hinweise. Maßgeblich ist, was du im echten Spiel beobachtest.

## 2. Phase 1: Aufklärung (bevor Bot-Logik entsteht)
- Installiere Playwright (Chromium und WebKit) und öffne pokelike.xyz selbst. Spiel mehrere Runs per Skript oder Schritt für Schritt durch und dokumentiere JEDEN Bildschirm.
- Finde heraus: DOM oder Canvas? Welches Framework? Wie sieht die Content Security Policy aus (wichtig für Skript-Injektion)? Gibt es einen globalen Spielzustand (window-Objekte, Store) oder Speicherstände in localStorage/IndexedDB? Woran erkennt man jeden Bildschirm eindeutig? Wie lassen sich Teamdaten (Pokémon, Level, KP, Typen, Attacken, Items) und Kartendaten (Knotentypen, Verbindungen, aktuelle Position) auslesen?
- Prüf die Spieleinstellungen, z. B. Kämpfe automatisch überspringen oder Entwicklungen überspringen. Der Bot soll sie nutzen, um schneller zu werden, darf sie aber erst nach Bestätigung in der Bot-Oberfläche ändern.
- Speichere echte DOM-Snapshots jedes Bildschirms als Test-Fixtures in tests/fixtures/.
- Ergebnisse in docs/GAME_RECON.md: Bildschirme, Erkennungsmerkmale, Selektoren, Datenquellen, CSP, Spielversion, offene Fragen.
- Lies die Spielversion (z. B. „v3.8“) aus und speichere sie mit. Der Bot muss Versionswechsel erkennen und melden.

## 3. Architektur
- TypeScript strict, esbuild oder Vite, ESLint + Prettier, Vitest für Unit-Tests, Playwright für End-to-End-Tests.
- Gemeinsamer Kern, identisch für beide Ziele, ohne doppelten Code:
  - core/state: StateReader liest Spielzustand und DOM nur lesend und liefert einen typisierten GameState.
  - core/screens: ScreenDetector als Zustandsautomat aller Bildschirme. Unbekannter Bildschirm heißt: pausieren und melden, niemals raten.
  - core/strategy: DecisionEngine mit reinen, testbaren Funktionen pro Entscheidungstyp.
  - core/actions: Actor führt Klicks, Taps und Drag & Drop (Pointer- UND Touch-Events) wie ein Mensch aus und prüft danach, ob die Aktion gewirkt hat. Bei Fehlschlag: Wiederholung mit Backoff, dann Pause.
  - core/data: Typentabelle (Gen I–VI inkl. Fee), Basiswerte und Typen der Pokémon, Arena-, Top-4- und Tower-Gegner. Bevorzugt aus den Spieldaten selbst, sonst kompakte gebündelte Daten (z. B. aus PokéAPI) mit Quellenangabe.
  - core/log: strukturierte Logs pro Entscheidung (Zustand, Optionen, Bewertungen, Wahl, Begründung) und Run-Statistiken, als Ringpuffer mit Größenlimit.
  - ui/: das Overlay-Panel.
- Plattform-Adapter in platform/chrome und platform/userscript für Speicher (chrome.storage bzw. GM.*), Zwischenablage, Benachrichtigungen, Zugriff auf Seitenvariablen und Tastenkürzel.
- Warten auf das Spiel: MutationObserver plus „Bildschirm ist stabil“-Erkennung (Animationen fertig, Buttons aktiv) statt fester Sleeps. Globaler Watchdog: Ändert sich X Sekunden lang nichts, Zustand neu einlesen. Hilft das nicht, Pause plus Meldung.
- Chrome drosselt Timer in Hintergrund-Tabs, iOS friert die Seite ein, wenn das Display ausgeht oder Safari in den Hintergrund geht. Erkenne das über visibilitychange, setze sauber fort, zeig einen Hinweis und nutze, wo möglich, die Wake Lock API.

## 4. Userscript-Regeln (verbindlich)
- Lies die README von quoid/userscripts und prüfe jede API dagegen. Nutze nur, was Userscripts (iOS), Tampermonkey und Violentmonkey gemeinsam unterstützen: die asynchrone GM.*-API (GM.getValue, GM.setValue, GM.deleteValue, GM.listValues, GM.addStyle, GM.setClipboard, GM.info). Alles andere nur mit Feature-Erkennung und Fallback. Benachrichtigungen laufen als In-Page-Toast plus optionaler Ton.
- Fallback auf localStorage unter eigenem Präfix, falls GM fehlt.
- Metadaten-Block: @name, @namespace, @version (SemVer), @description, @match https://pokelike.xyz/* (und ggf. www.), @run-at document-idle, @inject-into content, @noframes, @grant nur für tatsächlich genutzte GM-Funktionen, @updateURL auf die .meta.js und @downloadURL auf die .user.js (beide über GitHub raw aus diesem Repo).
- GM-APIs gibt es nur im Content-Kontext. Für lesenden Zugriff auf Seitenvariablen: kleines Seiten-Skript per script-Element (wenn die CSP es erlaubt) plus CustomEvent, sonst reiner DOM-Fallback. Beide Wege testen.
- Keine @require-Abhängigkeiten. Alles wird in eine Datei gebündelt (IIFE, ES2020, läuft ab Safari iOS 15), lesbar und nicht minifiziert.
- Doppelte Ausführung verhindern, sauber mit SPA-Navigation und Neuladen umgehen.

## 5. Chrome-Extras
- Popup für Schnellzugriff (Start/Pause/Status) und eine Optionsseite. Beide nutzen dieselben Einstellungen wie das Overlay.
- System-Benachrichtigungen und Tastenkürzel über „commands“, nur per Feature-Erkennung.
- Zugriff auf Seitenvariablen über ein Main-World-Skript.

## 6. Strategie (das Herzstück)
Für jede Entscheidung gilt: alle Optionen bewerten, die beste wählen, die Begründung loggen.
- Team-Bewertung: Level, Basiswerte/Stärke, KP-Stand, Offensiv-Coverage (tatsächliche Angriffstypen nach Item-Effekten), defensive Schwächen (0×/0,25×/0,5×/1×/2×/4×), geteilte Schwächen, Trait-Fortschritt, Synergie mit Relikten und Items.
- Vorausschau: den nächsten Boss (Arena, Top 4, Champ, Tower-Gegner) mit Typen und Team kennen und das eigene Team gezielt darauf vorbereiten.
- Routenwahl: Pfade auf der Karte bewerten. Der Wert eines Knotens hängt vom Teamzustand ab: XP, wenn das Team zu schwach ist; Heilung, wenn KP knapp sind; Shop, wenn Geld da ist; Tausch, wenn ein Slot entbehrlich ist; Items für das passende Matchup. Risiko gegen Ertrag abwägen.
- Fangen oder überspringen, und bei „Team Full“ ersetzen oder behalten: anhand der Team-Bewertung vorher und nachher. Im Nuzlocke-Modus „ein Fang pro Zone“ und Permadeath strikt beachten und deutlich vorsichtiger spielen.
- Items und Relikte: Wirkung, Anwendungsbereich und Träger bewerten. Item-Boni nur zählen, wenn die passende Attacke wirklich genutzt wird. Früh XP-Items wie den Glücks-Ei bevorzugen. Items dem richtigen Träger geben.
- Tausch: nur annehmen, wenn die Team-Bewertung danach messbar besser ist.
- Kampfreihenfolge vor jedem Kampf: den besten Konter für den ersten Gegner nach vorn, keine gleiche Schwäche vorn stapeln, den Carry schützen.
- Shop/Pokémart: Budget-Logik. Im Tower sinnvoll in EVs/Vitamine investieren.
- Starter- und Regionswahl konfigurierbar, Standard ist eine sichere, ausgewogene Wahl.
- Strategieprofile: Sicher / Ausgewogen / Aggressiv. Alle Gewichte liegen zentral in einer Konfiguration.
- Lernen aus Daten: Ergebnisse jeder Entscheidung mit dem Run-Ausgang speichern. Biete eine Auswertung an, welche Entscheidungen mit Siegen oder Niederlagen zusammenhängen, und ermögliche vorsichtiges Nachjustieren der Gewichte (nur mit Bestätigung, mit Rückgängig).
- Optional als eigenes Modul: Löser für das Daily Pokésort.
- Fair Play: Der Bot spielt nur über die normale Oberfläche wie ein Mensch. Keine Manipulation von Speicherständen, localStorage des Spiels, Netzwerkanfragen, Account- oder Hall-of-Fame-Daten, keine massenhaften Anfragen an den Server. Er klickt niemals „Reset Run“, Löschen oder Logout, außer das ist in den Einstellungen ausdrücklich erlaubt.

## 7. Oberfläche
Das Overlay auf der Spielseite ist bei beiden Varianten die Hauptbedienung.
- Inhalt: Was braucht der Nutzer fast immer? Start/Pause, was der Bot gerade tut und warum, Team-Zustand, Fortschritt. Das gehört groß und sofort sichtbar nach vorn. Einstellungen, Log und Statistik kommen aufgeräumt dahinter (Tabs oder ausklappbare Bereiche).
- Technik: Shadow DOM, damit Spiel- und Bot-CSS sich nicht stören. Ziehbar (Maus und Finger), minimierbar zu einer kleinen Pille, an Ränder andockbar, Position wird gespeichert. Verdeckt keine wichtigen Spielbuttons.
- Steuerung: Start / Pause / Stopp, Einzelschritt (genau eine Entscheidung), „Nur vorschlagen“-Modus (der Bot hebt die empfohlene Option im Spiel hervor und zeigt die Begründung, klickt aber nicht).
- Einstellungen: Modus (Story Classic/Nuzlocke, Region, Battle Tower inkl. Stufe und Schwierigkeit, Challenge), Strategieprofil, Tempo (Verzögerungsbereich mit Zufallsanteil), Stopp-Bedingungen (nach N Runs, bei Champ-Sieg, bei Shiny, bei Niederlage, nach Zeit), Ton an/aus, erlaubte riskante Aktionen, Autostart nach Seitenladen (Standard: aus). Zu jeder Einstellung eine kurze Erklärung und ein sinnvoller Standardwert.
- Live-Anzeige: aktueller Bildschirm/Knoten, Team mit KP und Level, nächster Boss, letzte Entscheidung samt Begründung, Statistik (Runs, Siege, Siegquote, Rekord, Laufzeit).
- Log mit Filter. Export/Import von Logs und Einstellungen als JSON.
- Fehlermeldungen in Alltagssprache (z. B. „Unbekannter Bildschirm erkannt, Bot pausiert. Bitte einmal von Hand weiterklicken.“) plus Knopf „Debug-Infos kopieren“.
- Deutsch als Standard, Englisch umschaltbar. Desktop-Tastenkürzel konfigurierbar, auf iOS alles per Tippen bedienbar.
- Design-Prozess (mit dem Plugin frontend-design):
  1. Design-System in docs/UI.md: Farbpalette passend zum dunklen Spiel-Look mit einer Akzentfarbe, Statusfarben (läuft/pausiert/Fehler), maximal 3–4 Schriftgrößen, Abstände 4/8/12/16/24 px, runde Ecken, dezente Schatten, Icons als Inline-SVG, sanfte Übergänge, klare Hierarchie, viel Luft.
  2. Zwei bis drei deutlich unterschiedliche Entwürfe als HTML-Mockups, Screenshots per Playwright (Desktop 1440×900 und iPhone 390×844), selbst ansehen, ehrlich bewerten, den besten wählen, Begründung in DECISIONS.md.
  3. Nach der Umsetzung JEDEN Zustand screenshotten (eingeklappt, läuft, pausiert, Fehler, Einstellungen, Log, Statistik, erster Start ohne Daten) und kritisch prüfen: sofort verständlich? Etwas abgeschnitten, gequetscht, zu klein? Mit einem Daumen bedienbar? Safe Areas/Notch beachtet? Mindestens zwei Verbesserungsrunden mit dem ui-reviewer.
  4. Finale Screenshots in docs/screenshots/.

## 8. Tests und Qualität
- Unit-Tests für jede Strategiefunktion mit konkreten Szenarien, auch Grenzfälle: Team voll, alle KP niedrig, Nuzlocke-Tod, kein Geld, Item ohne passende Attacke, unbekanntes Pokémon/Item.
- Tests für den ScreenDetector gegen alle Fixtures.
- End-to-End: Chrome mit geladener Erweiterung sowie das Userscript mit GM-Shim in Chromium und WebKit (iPhone-Emulation, Touch aktiv) spielen echte Runs auf pokelike.xyz. Ziel ist mindestens ein vollständiger Story-Run bis Champ oder Game Over ohne Hänger. Danach Siegquote über mehrere Runs messen, Logs auswerten, Strategie gezielt verbessern. Vorher und nachher dokumentieren.
- Automatischer Check: Das Userscript-Bundle nutzt keine APIs außerhalb der erlaubten Schnittmenge, der Metadaten-Block ist korrekt.
- Fehlerresistenz: Seiten-Reload mitten im Run (Resume erkennen), Spiel-Update mit geänderten Texten oder Klassen (Selektoren über Text und Rolle statt fragiler Klassen, Fallbacks), langsames Netz, Tab im Hintergrund, iOS-Display aus und wieder an.
- Keine stillen Fehler, keine leeren catch-Blöcke. Alles Unerwartete wird geloggt und in der UI gemeldet.

## 9. Lieferung
- Skripte: npm run build (beide Ziele), npm run build:chrome, npm run build:userscript, npm test, npm run e2e.
- dist/chrome/ (entpackt ladbar, plus zip) sowie dist/pokelike-bot.user.js und dist/pokelike-bot.meta.js (eingecheckt, damit die GitHub-raw-Links funktionieren). @version bei jedem Release erhöhen.
- README auf Deutsch: Installation in Chrome und auf dem iPhone (Userscripts), Updates, Bedienung, Einstellungen, Fehlerbehebung, bekannte Grenzen.
- docs/GAME_RECON.md, docs/STRATEGY.md (wie und warum der Bot entscheidet), docs/UI.md, docs/screenshots/, CHANGELOG.
Prüf das ganze Repo inklusive Git-Verlauf auf Passwörter, API-Keys, Tokens oder persönliche Daten, bevor ich es auf Public stelle. Sag mir, ob es sicher ist.
@"pokelike-save.json.txt" (Anhang: Spielstand als localStorage-Export)

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

---

## Frühere Anforderungen aus dem Vorgänger-Branch (wörtlich, `claude/pokelike-bot-extension-skalzp:docs/REQUIREMENTS.md`, Stand 2026-11-25)

_Das ist kein Originaltext des Nutzers, sondern die Anforderungsliste früherer Sessions, abgeleitet aus Gesprächen mit dem Nutzer. Sie ist hier unverändert gesichert, damit nichts verloren geht. Die Zuordnung zu den R-IDs steht am Ende von REQUIREMENTS.md, die Konflikte mit dem Hauptauftrag regeln D-017 bis D-020._

### Anforderungen

Einzige Quelle der Wahrheit für **was** gebaut wird. Neue oder geänderte Anforderungen des Nutzers werden hier
eingetragen, bevor sie umgesetzt werden. Den Stand der Umsetzung hält `docs/PROGRESS.md` fest.

#### R1 Ziel

Ein Bot, der https://pokelike.xyz selbstständig, effizient und klug spielt.

#### R2 Ziele und Plattformen (eine Codebasis)

- R2.1 **Chrome MV3** (auch Edge, Opera, andere Chromium-Browser): entpackt und als Zip, mit Popup, Optionsseite,
  Tastenkürzeln (`commands`) und Benachrichtigungen. Was der Browser nicht kann, wird per Feature-Erkennung erkannt;
  dann greifen In-Page-Toasts.
- R2.2 **Userscript** (`.user.js` + `.meta.js`) für die iOS-App „Userscripts“, Tampermonkey und Violentmonkey: GM.*-Adapter,
  Bridge über ein Script-Element plus CustomEvent mit DOM-Fallback, In-Page-Toasts, eigene Tastenkürzel.
- R2.3 Gemeinsamer Code liegt in `src/core` und `src/ui`, plattformspezifischer nur in `src/platform/chrome` und
  `src/platform/userscript`. Safari/Xcode wird nicht unterstützt.
- R2.4 npm-Skripte: `build`, `build:chrome`, `build:userscript`, `test`, `e2e` (Chrome mit Erweiterung; Userscript mit
  GM-Shim in Chromium und WebKit/iPhone).

#### R3 Architektur und Qualität

- R3.1 TypeScript strict, esbuild, ESLint + Prettier, Vitest, Playwright.
- R3.2 `core/screens`: Bildschirmerkennung. Bei einem **unbekannten Bildschirm pausiert der Bot** und rät nie.
- R3.3 `core/strategy`: reine, unit-getestete Funktionen. Jede Entscheidung trägt eine Begründung.
- R3.4 `core/actions`: menschenähnliche Aktionen, Erfolg prüfen, Backoff.
- R3.5 `core/data`: Daten bevorzugt aus dem Spiel selbst. Die Spielversion wird erkannt; bei einer neuen Version wird gewarnt.
- R3.6 Recon jedes Bildschirms in `docs/GAME_RECON.md`, DOM-Fixtures in `tests/fixtures/`.

#### R4 Spielmodi

- R4.1 Story (Classic/Nuzlocke, Region, Charakter, Starter): Ziel ist, den Champ sicher zu besiegen.
- R4.2 **Challenges (Schwerpunkt):** Arena-, Tages- und Wochen-Challenge mit Orden-Stufe. Traits, Augments und Relikte
  sind dort aktiv und müssen berücksichtigt werden. Kombos und Traits gezielt nutzen.
- R4.3 Den Challenge-Starter (aus dem PC) kann man vorher auswählen.
- R4.4 Relikte und Items werden anhand der Spieldaten bewertet (Item-Handbuch / `PASSIVE_ITEM_POOL`).
- R4.5 Battle Tower experimentell.

#### R5 Sicherheit und Fairness (nicht verhandelbar)

- R5.1 **Pokédollar** (Shop, Eier, Vitamine) gibt der Bot nie ohne ausdrückliche Bestätigung des Nutzers aus.
- R5.2 Der Bot schreibt nie in den localStorage des Spiels und patcht keine Spielfunktionen. Ausnahmen: die dokumentierten
  UI-Öffner (`openUsableItemModal`, `openItemEquipModal`) und `saveSettings` mit Whitelist, nur nach zweistufiger Bestätigung.
- R5.3 Simulationen laufen nur mit eigenen Seeds. Echte Zufallsergebnisse werden nie vorhergesagt.
- R5.4 Private Spielstände und Tokens werden nie committet (`tests/fixtures/private/`, `*.save.json`).

#### R6 Dokumentation

- R6.1 Das README beschreibt die Installation für beide Ziele (auch Opera) und die Bedienung.
