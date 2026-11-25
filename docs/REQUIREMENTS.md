# Anforderungen – einzige Quelle der Wahrheit

**Legende:** ✅ erledigt und nachweislich getestet · 🟡 teilweise · ❌ offen
**Format jeder Zeile:** `- <Status> **R-NNN** [Pn] <prüfbare Anforderung> — Quelle: … — Nachweis: …`
**Phase** `[Pn]`: In dieser Phase aus `docs/PLAN.md` wird der Punkt umgesetzt und abgenommen.
**Quellen:** `[HA §x]` Hauptauftrag, Abschnitt x (`docs/AUFTRAG.md`) · `[EA]` Einrichtungsauftrag · `[eigene Idee]` eigene Ergänzung als Product Owner

**Regeln**
- ✅ gibt es nur mit Nachweis: einem Test (`tests/…:Testname`), der die Anforderung wirklich prüft und gerade grün ist, oder einem aktuellen Screenshot (`docs/screenshots/…png`). Ohne Nachweis ist ein Punkt höchstens 🟡.
- IDs werden nie neu vergeben und nie umnummeriert. Ein neuer Punkt bekommt die nächste freie Nummer, auch wenn er thematisch in einen früheren Bereich gehört. Zeilen dürfen zwischen Bereichen verschoben werden.
- Nichts wird gelöscht oder zusammengekürzt. Ist ein Punkt überholt, wird er `~~durchgestrichen~~` und bekommt Begründung und D-Verweis (`docs/DECISIONS.md`).
- Jeder Satz des Hauptauftrags ist mindestens einer R-ID zugeordnet (Zuordnungstabelle am Ende).
- Nächste freie ID: **R-220**

---

## A. Ziel und Build-Ziele
- ❌ **R-028** [P6] Der Bot spielt pokelike.xyz selbstständig: komplette Runs vom Hauptmenü bis Champ oder Game Over, ohne menschlichen Eingriff, außer bei gemeldeten Ausnahmen. — Quelle: [HA Ziel] „selbstständig“ — Nachweis: –
- ❌ **R-029** [P4] Der Bot spielt effizient: keine unnötigen Wartezeiten, Beschleunigungs-Einstellungen des Spiels werden genutzt (R-074). Die durchschnittliche Dauer pro Run wird gemessen und in `docs/STRATEGY.md` dokumentiert. — Quelle: [HA Ziel] „effizient“ — Nachweis: –
- ❌ **R-030** [P4] Durchdachte Entscheidungen statt Zufall: Jede Entscheidung beruht auf einer Bewertung aller Optionen. Die DecisionEngine ist bei gleichem Zustand und gleicher Konfiguration deterministisch. Zufall gibt es nur bei den Verzögerungszeiten. — Quelle: [HA Ziel] „klug … durchdachte Entscheidungen statt Zufall“ — Nachweis: –
- ❌ **R-031** [P4] Aufmerksamkeit für jede Kleinigkeit: Kein entscheidungsrelevanter Wert, der im GameState verfügbar ist, bleibt ungenutzt. Für jeden Bewertungsfaktor zeigt ein Test, dass er die Wahl beeinflusst. — Quelle: [HA Ziel] „starke Runs, Aufmerksamkeit für jede Kleinigkeit“ — Nachweis: –
- ❌ **R-032** [P2] Eine Codebasis für zwei Build-Ziele. Kern- und UI-Code gibt es genau einmal, plattformspezifischer Code steht nur in `platform/*`. Ein automatischer Check (Import-Grenzen) verhindert Plattform-APIs (`chrome.*`, `GM.*`) in `core/` und `ui/`. — Quelle: [HA Ziel] „aus EINER Codebasis“, [HA §3] „ohne doppelten Code“ — Nachweis: –
- ❌ **R-033** [P2] Build-Ziel 1 ist eine Chrome-Erweiterung mit Manifest V3, die sich entpackt laden lässt. Ein E2E-Test lädt `dist/chrome/`. — Quelle: [HA Ziel] — Nachweis: –
- ❌ **R-034** [P2] Build-Ziel 2 ist genau eine `.user.js` für die iOS-App „Userscripts“ von quoid in Safari. — Quelle: [HA Ziel] — Nachweis: –
- ❌ **R-035** [P6] Das Userscript ist auch mit Tampermonkey und Violentmonkey kompatibel. Belegt wird das durch den API-Abgleich mit deren Doku und durch Tests mit GM-Shim. — Quelle: [HA Ziel] — Nachweis: –
- ✅ **R-014** [P0] Kein Safari, keine Safari-Web-Extension, kein Xcode. Alte Safari- oder Xcode-Teile werden entfernt. — Quelle: [EA] „lösche … alles für Safari/Xcode“, [HA Ziel] „Keine Safari-Web-Extension, kein Xcode“ — Nachweis: Repo-Prüfung am 2026-11-25 (`find . -path ./.git -prune -o -type f -print` zeigte nur `README.md`, keine Safari- oder Xcode-Dateien)

## B. Spielwissen, Modi und Spielablauf
- ❌ **R-036** [P1] Alle Angaben aus HA §1 werden live im Spiel geprüft. `docs/GAME_RECON.md` kennzeichnet jede als bestätigt, widerlegt oder offen, jeweils mit Datum und Spielversion. — Quelle: [HA §1] „live prüfen, nicht blind übernehmen“ — Nachweis: –
- ❌ **R-037** [P4] Pokelike ist ein Autobattler, die Kämpfe laufen automatisch. Der Bot greift nicht in laufende Kämpfe ein. Er gewinnt über die Entscheidungen vor dem Kampf und wartet Kampfbildschirme nur ab oder überspringt sie per Spieleinstellung. — Quelle: [HA §1] — Nachweis: –
- ❌ **R-038** [P3] Modus Story Classic ist spielbar, inklusive Regionswahl (alle im Spiel verfügbaren Regionen, z. B. Kanto, Johto, Hoenn), Arenen, Top 4 und Champ. — Quelle: [HA §1] — Nachweis: –
- ❌ **R-039** [P4] Modus Story Nuzlocke ist spielbar, unter Einhaltung der Regeln aus R-062 und R-127. — Quelle: [HA §1] — Nachweis: –
- ❌ **R-040** [P4] Modus Battle Tower ist spielbar: regionale Stufen, Start mit freigeschalteten Pokémon, Typ-Boni und Traits, Schwierigkeit Normal oder Hardcore, Stage Select. — Quelle: [HA §1] — Nachweis: –
- ❌ **R-041** [P4] Modus Challenges ist spielbar, und zwar alle Challenge-Arten, die in Phase 1 gefunden werden. Nicht unterstützte Arten erkennt der Bot und meldet sie, statt sie zu spielen. — Quelle: [HA §1] — Nachweis: –
- ❌ **R-042** [P3] Multiplayer („Coming Soon“) wird ignoriert. Der Bot betritt ihn nie. Erscheint er, meldet der Bot ihn als „nicht unterstützt“. — Quelle: [HA §1] — Nachweis: –
- ❌ **R-043** [P3] Der Run-Ablauf ist vollständig abgedeckt: Charakter wählen → Starter wählen → Karte mit Routenentscheidungen → Orden → „Next Map →“ → Top 4 → Champ bzw. Game Over. — Quelle: [HA §1] — Nachweis: –
- ❌ **R-044** [P3] Alle Knotentypen der Karte werden erkannt und behandelt: Kampf, Trainer, Arena, Shop/Pokémart, Item, Event „?“, Tausch und alle weiteren aus Phase 1. Laut Spielstand gibt es u. a. `start`, `battle`, `trainer`, `catch`, `question`, `item`, `pokecenter` und `boss`. — Quelle: [HA §1], Spielstand des Nutzers — Nachweis: –
- ❌ **R-045** [P3] Bildschirm „Wild Pokémon Appeared“ wird erkannt (Fixture-Test) und behandelt: kämpfen bzw. fangen oder fliehen. — Quelle: [HA §1] — Nachweis: –
- ❌ **R-046** [P3] Bildschirm „Item Found“ wird erkannt und behandelt: ein Item wählen oder überspringen. — Quelle: [HA §1] — Nachweis: –
- ❌ **R-047** [P3] Bildschirm „Relic“ wird erkannt und behandelt: genau eines wählen, es bleibt für den ganzen Run. — Quelle: [HA §1] — Nachweis: –
- ❌ **R-048** [P3] Bildschirm „Team Full“ wird erkannt und behandelt: ersetzen oder behalten. — Quelle: [HA §1] — Nachweis: –
- ❌ **R-049** [P3] Bildschirm „Trade Offer“ wird erkannt und behandelt: annehmen oder ablehnen. — Quelle: [HA §1] — Nachweis: –
- ❌ **R-050** [P3] Bildschirm „Badge Earned“ wird erkannt und mit „Next Map →“ fortgesetzt. — Quelle: [HA §1] — Nachweis: –
- ❌ **R-051** [P3] Bildschirm „Choose Your Order“ wird erkannt. Die Reihenfolge wird per Drag & Drop gesetzt, danach folgt „FIGHT!“. — Quelle: [HA §1] — Nachweis: –
- ❌ **R-052** [P3] Bildschirm Game Over wird erkannt. Je nach Stopp-Bedingungen folgt „Play Again“ oder „Main Menu“. — Quelle: [HA §1] — Nachweis: –
- ❌ **R-053** [P3] Bildschirm Champion wird erkannt. Je nach Einstellungen folgt „Play Again“, „Climb the Tower“ oder „Home“. „Share“ klickt der Bot nie automatisch [eigene Idee]. — Quelle: [HA §1] — Nachweis: –
- ❌ **R-054** [P3] Entwicklungs-Bildschirme werden erkannt und behandelt. — Quelle: [HA §1] — Nachweis: –
- ❌ **R-055** [P3] Der Bildschirm Shop/Pokémart wird erkannt und behandelt. — Quelle: [HA §1] — Nachweis: –
- ❌ **R-056** [P3] Resume-Buttons, also das Fortsetzen eines laufenden Runs, werden erkannt und behandelt. — Quelle: [HA §1] — Nachweis: –
- ❌ **R-057** [P3] Charakterwahl („Who are you?“, BOY/GIRL) und Starterwahl („Choose Your Starter!“) werden erkannt und behandelt. — Quelle: [HA §1] — Nachweis: –
- ❌ **R-058** [P4] Mechanik: Das erste lebende Pokémon im Team kämpft zuerst. Die Reihenfolge wird deshalb vor jedem Kampf bewusst gesetzt. In Phase 1 wird die Mechanik live bestätigt. — Quelle: [HA §1] — Nachweis: –
- ❌ **R-059** [P4] Mechanik: Gehaltene Items können Angriffstyp und Wirkung verändern. Die Bewertung rechnet mit den tatsächlichen Angriffstypen nach Item-Effekten. — Quelle: [HA §1], [HA §6] — Nachweis: –
- ❌ **R-060** [P4] Mechanik Traits: Jede Trait-Stufe braucht 2 Punkte. Normale Pokémon geben 1 Punkt pro Typ, Shinys 2. Die Berechnung ist mit Unit-Tests für konkrete Teams belegt. — Quelle: [HA §1] — Nachweis: –
- ❌ **R-061** [P4] Mechanik: Level-ups und Sonderbonbons beleben besiegte Pokémon NICHT wieder. Die Strategie plant nie mit einer Wiederbelebung durch Level. — Quelle: [HA §1] — Nachweis: –
- ❌ **R-062** [P4] Nuzlocke-Regeln: ein Fang pro Zone, Besiegte sind für immer weg. Der Bot hält beides strikt ein, belegt durch Tests. — Quelle: [HA §1], [HA §6] — Nachweis: –
- ❌ **R-063** [P4] Battle Tower: Die dauerhaften EV-Upgrades (Vitamine) für Pokédollar fließen in die Planung ein. — Quelle: [HA §1] — Nachweis: –
- ❌ **R-064** [P1] Die Quellen pokelike.wiki (z. B. `/battle-tower/`, `/guides/kanto/`, `/traits/`, `/items/`) und pokelike-guide.fr werden ausgewertet. Übernommene Daten tragen eine Quellenangabe und gelten nur als Hinweis. Bei Widerspruch gilt, was im Spiel beobachtet wurde. — Quelle: [HA §1] — Nachweis: –

## C. Aufklärung (Phase 1, bevor Bot-Logik entsteht)
- ❌ **R-065** [P1] Playwright mit Chromium UND WebKit ist installiert und lauffähig, auch in der Cloud-Umgebung. Der Installationsweg steht in DECISIONS.md (D-011). — Quelle: [HA §2] — Nachweis: –
- ❌ **R-066** [P1] pokelike.xyz wurde selbst geöffnet, und mehrere Runs wurden per Skript oder Schritt für Schritt gespielt. JEDER dabei aufgetretene Bildschirm ist in `docs/GAME_RECON.md` dokumentiert. — Quelle: [HA §2] — Nachweis: –
- ❌ **R-067** [P1] Geklärt und dokumentiert ist, ob das Spiel DOM oder Canvas nutzt und welches Framework. — Quelle: [HA §2] — Nachweis: –
- ❌ **R-068** [P1] Die Content Security Policy (HTTP-Header und Meta) ist dokumentiert, samt Folgen für die Skript-Injektion (Seiten-Skript im Userscript, Main-World in Chrome). — Quelle: [HA §2] — Nachweis: – (Vorab-Befund vom 2026-11-25 in GAME_RECON.md)
- ❌ **R-069** [P1] Geklärt und dokumentiert ist, ob es einen globalen Spielzustand gibt (window-Objekte, Store) und wie die Speicherstände in localStorage/IndexedDB aufgebaut sind. — Quelle: [HA §2] — Nachweis: – (Vorab-Befund aus dem Spielstand in GAME_RECON.md)
- ❌ **R-070** [P1] Für jeden Bildschirm ist dokumentiert, woran er sich eindeutig erkennen lässt (Erkennungsmerkmale, robuste Selektoren). — Quelle: [HA §2] — Nachweis: –
- ❌ **R-071** [P1] Dokumentiert ist, wie sich die Teamdaten auslesen lassen: Pokémon, Level, KP, Typen, Attacken, Items. — Quelle: [HA §2] — Nachweis: –
- ❌ **R-072** [P1] Dokumentiert ist, wie sich die Kartendaten auslesen lassen: Knotentypen, Verbindungen, aktuelle Position. — Quelle: [HA §2] — Nachweis: –
- ❌ **R-073** [P1] Die Spieleinstellungen sind geprüft und dokumentiert, z. B. Kämpfe und Entwicklungen automatisch überspringen. Laut Spielstand gibt es u. a. `autoSkipBattles`, `autoSkipAllBattles`, `autoSkipEvolve`, `skipTraitFx`, `hideBossPreview`, `language` und `darkMode`. — Quelle: [HA §2] — Nachweis: –
- ❌ **R-074** [P5] Der Bot nutzt die Spieleinstellungen, um schneller zu werden. Ändern darf er sie erst nach Bestätigung in der Bot-Oberfläche. — Quelle: [HA §2] — Nachweis: –
- ❌ **R-075** [P1] Echte DOM-Snapshots JEDES Bildschirms liegen als Test-Fixtures in `tests/fixtures/`, bereinigt von persönlichen Daten (R-148). — Quelle: [HA §2] — Nachweis: –
- ❌ **R-076** [P1] `docs/GAME_RECON.md` enthält Bildschirme, Erkennungsmerkmale, Selektoren, Datenquellen, CSP, Spielversion und offene Fragen. — Quelle: [HA §2], [HA §9] — Nachweis: –
- ❌ **R-077** [P1] Die Spielversion (z. B. „v3.8“) wird ausgelesen und mit Fixtures und Logs gespeichert. — Quelle: [HA §2] — Nachweis: –
- ❌ **R-012** [P3] Der Bot erkennt einen Wechsel der Spielversion und meldet ihn, statt still falsch zu spielen. — Quelle: [HA §2] „Der Bot muss Versionswechsel erkennen und melden“ (ursprünglich [eigene Idee]) — Nachweis: –

## D. Architektur und Kern
- ❌ **R-078** [P2] TypeScript im strict-Modus. — Quelle: [HA §3] — Nachweis: –
- ❌ **R-079** [P2] Als Bundler kommt esbuild oder Vite zum Einsatz. Die Wahl ist mit Begründung in DECISIONS.md festgehalten. — Quelle: [HA §3] — Nachweis: –
- ❌ **R-080** [P2] ESLint und Prettier sind eingerichtet, und `npm run lint` läuft fehlerfrei. — Quelle: [HA §3] — Nachweis: –
- ❌ **R-081** [P2] Vitest für Unit-Tests. — Quelle: [HA §3] — Nachweis: –
- ❌ **R-082** [P2] Playwright für End-to-End-Tests. — Quelle: [HA §3] — Nachweis: –
- ❌ **R-083** [P3] `core/state`: Der StateReader liest Spielzustand und DOM ausschließlich lesend und liefert einen typisierten GameState. Ein Test belegt, dass er nicht in DOM oder Storage des Spiels schreibt. — Quelle: [HA §3] — Nachweis: –
- ❌ **R-084** [P3] `core/screens`: Der ScreenDetector ist ein Zustandsautomat über alle Bildschirme. — Quelle: [HA §3] — Nachweis: –
- ❌ **R-010** [P3] Ein unbekannter oder unerwarteter Bildschirm führt zu Pause und Meldung, der Bot rät niemals. Er protokolliert den Zustand mit einem Snapshot (R-215). — Quelle: [HA §3] „Unbekannter Bildschirm heißt: pausieren und melden, niemals raten“ (ursprünglich [eigene Idee]) — Nachweis: –
- ❌ **R-085** [P4] `core/strategy`: Die DecisionEngine besteht aus reinen, testbaren Funktionen, eine pro Entscheidungstyp. — Quelle: [HA §3] — Nachweis: –
- ❌ **R-086** [P3] `core/actions`: Der Actor führt Klicks, Taps und Drag & Drop wie ein Mensch aus, mit Pointer- UND Touch-Events. — Quelle: [HA §3] — Nachweis: –
- ❌ **R-087** [P3] Der Actor prüft nach jeder Aktion, ob sie gewirkt hat. Schlägt sie fehl, wiederholt er sie mit Backoff und pausiert danach mit einer Meldung. — Quelle: [HA §3] — Nachweis: –
- ❌ **R-088** [P3] `core/data` enthält die Typentabelle für Gen I–VI inklusive Fee, vollständig, mit Quellenangabe und Unit-Test gegen Referenzwerte. — Quelle: [HA §3] — Nachweis: –
- ❌ **R-089** [P3] `core/data` liefert Basiswerte und Typen der Pokémon. Bevorzugte Quelle sind die Spieldaten selbst (laut Spielstand legt das Spiel `pkrl_poke_*` und `pkrl_species_list` im Cache ab). Sonst kommen kompakte gebündelte Daten zum Einsatz (z. B. aus PokéAPI), mit Quellenangabe. — Quelle: [HA §3] — Nachweis: –
- ❌ **R-090** [P4] `core/data` enthält die Gegner aus Arenen, Top 4 und Tower (Typen und Teams). Bevorzugte Quelle sind die Spieldaten, sonst gebündelte Daten mit Quellenangabe. — Quelle: [HA §3] — Nachweis: –
- ❌ **R-006** [P3] `core/log` protokolliert jede Entscheidung strukturiert: Zustand, Optionen, Bewertungen, Wahl, Begründung. Ablage und Format nach D-005, Export echter Runs nach `runs/`. — Quelle: [HA §3], [EA] strategy-reviewer „anhand der Logs echter Runs“ — Nachweis: –
- ❌ **R-091** [P3] `core/log` führt Run-Statistiken. Die Logs liegen in einem Ringpuffer mit Größenlimit, ein Test belegt, dass das Limit eingehalten wird und die ältesten Einträge herausfallen. — Quelle: [HA §3] — Nachweis: –
- ❌ **R-092** [P5] `ui/` enthält das Overlay-Panel als eigenes Modul, das für beide Ziele identisch ist. — Quelle: [HA §3] — Nachweis: –
- ❌ **R-093** [P3] `platform/chrome` und `platform/userscript` liefern Adapter für Speicher (chrome.storage bzw. GM.*), Zwischenablage, Benachrichtigungen, Zugriff auf Seitenvariablen und Tastenkürzel. Beide nutzen eine gemeinsame Schnittstelle, beide Implementierungen sind getestet. — Quelle: [HA §3] — Nachweis: –
- ❌ **R-094** [P3] Gewartet wird auf das Spiel über einen MutationObserver plus „Bildschirm ist stabil“-Erkennung (Animationen fertig, Buttons aktiv), nicht über feste Sleeps. Ein Check belegt, dass es keine festen Wartezeiten gibt außer der Tempo-Verzögerung. — Quelle: [HA §3] — Nachweis: –
- ❌ **R-095** [P3] Ein globaler Watchdog liest den Zustand neu ein, wenn sich X Sekunden lang nichts ändert (X konfigurierbar). Hilft das nicht, pausiert der Bot und meldet sich. — Quelle: [HA §3] — Nachweis: –
- ❌ **R-096** [P6] Gedrosselte Timer in Chrome-Hintergrund-Tabs und das Einfrieren unter iOS (Display aus, Safari im Hintergrund) erkennt der Bot per `visibilitychange`. Er setzt sauber fort und zeigt einen Hinweis. — Quelle: [HA §3] — Nachweis: –
- ❌ **R-097** [P6] Die Wake Lock API wird genutzt, wo sie verfügbar ist (Feature-Erkennung). — Quelle: [HA §3] — Nachweis: –

## E. Userscript (verbindlich)
- ❌ **R-098** [P2] Die README von quoid/userscripts ist gelesen, und jede genutzte API ist dagegen geprüft. Der Abgleich ist dokumentiert. — Quelle: [HA §4] — Nachweis: –
- ❌ **R-099** [P2] Genutzt wird nur, was Userscripts (iOS), Tampermonkey und Violentmonkey gemeinsam unterstützen: die asynchrone GM.*-API mit `GM.getValue`, `GM.setValue`, `GM.deleteValue`, `GM.listValues`, `GM.addStyle`, `GM.setClipboard` und `GM.info`. — Quelle: [HA §4] — Nachweis: –
- ❌ **R-100** [P2] Alles außerhalb dieser Schnittmenge wird nur mit Feature-Erkennung und Fallback genutzt. — Quelle: [HA §4] — Nachweis: –
- ❌ **R-101** [P3] Benachrichtigungen erscheinen im Userscript als In-Page-Toast plus optionalem Ton. — Quelle: [HA §4] — Nachweis: –
- ❌ **R-102** [P2] Fehlt GM, wird auf localStorage unter eigenem Präfix ausgewichen. Das Präfix kollidiert nicht mit den Schlüsseln des Spiels (`poke_*`, `pkrl_*`). — Quelle: [HA §4] — Nachweis: –
- ❌ **R-103** [P2] Der Metadaten-Block enthält `@name`, `@namespace`, `@version` (SemVer), `@description`, `@match https://pokelike.xyz/*` (ggf. auch `https://www.pokelike.xyz/*`), `@run-at document-idle`, `@inject-into content` und `@noframes`. — Quelle: [HA §4] — Nachweis: –
- ❌ **R-104** [P2] `@grant` steht nur für tatsächlich genutzte GM-Funktionen, automatisch abgeglichen zwischen Bundle und `@grant`. — Quelle: [HA §4] — Nachweis: –
- ❌ **R-105** [P2] `@updateURL` zeigt auf die `.meta.js`, `@downloadURL` auf die `.user.js`, beide über GitHub raw aus diesem Repo. — Quelle: [HA §4] — Nachweis: –
- ❌ **R-106** [P3] GM-APIs gibt es nur im Content-Kontext. Lesender Zugriff auf Seitenvariablen läuft über ein kleines Seiten-Skript per script-Element (wenn die CSP es erlaubt) plus CustomEvent, sonst über einen reinen DOM-Fallback. Beide Wege sind getestet. — Quelle: [HA §4] — Nachweis: –
- ❌ **R-107** [P2] Es gibt keine `@require`-Abhängigkeiten. Alles ist in eine Datei gebündelt: IIFE, ES2020, läuft ab Safari iOS 15, lesbar und nicht minifiziert. — Quelle: [HA §4] — Nachweis: –
- ❌ **R-108** [P3] Doppelte Ausführung wird verhindert, etwa bei erneuter Injektion oder wenn Erweiterung und Userscript gleichzeitig aktiv sind. — Quelle: [HA §4] — Nachweis: –
- ❌ **R-109** [P3] SPA-Navigation und Neuladen werden sauber behandelt: kein doppeltes Overlay, der Zustand wird übernommen. — Quelle: [HA §4] — Nachweis: –

## F. Chrome-Extras
- ❌ **R-110** [P5] Popup für den Schnellzugriff: Start, Pause, Status. — Quelle: [HA §5] — Nachweis: –
- ❌ **R-111** [P5] Optionsseite. — Quelle: [HA §5] — Nachweis: –
- ❌ **R-112** [P5] Popup, Optionsseite und Overlay nutzen dieselben Einstellungen. Eine Änderung an einer Stelle wirkt sofort überall, belegt durch einen Test. — Quelle: [HA §5] — Nachweis: –
- ❌ **R-113** [P5] System-Benachrichtigungen werden nur per Feature-Erkennung genutzt. — Quelle: [HA §5] — Nachweis: –
- ❌ **R-114** [P5] Tastenkürzel laufen über „commands“, nur per Feature-Erkennung. — Quelle: [HA §5] — Nachweis: –
- ❌ **R-115** [P3] Auf Seitenvariablen wird über ein Main-World-Skript zugegriffen. — Quelle: [HA §5] — Nachweis: –

## G. Strategie (das Herzstück)
- ❌ **R-116** [P4] Für jede Entscheidung werden alle Optionen bewertet, die beste gewählt und die Begründung geloggt. Das Log enthält alle Optionen mit ihrem Score. — Quelle: [HA §6] — Nachweis: –
- ❌ **R-117** [P4] Die Team-Bewertung berücksichtigt Level, Basiswerte bzw. Stärke und den KP-Stand. — Quelle: [HA §6] — Nachweis: –
- ❌ **R-118** [P4] Die Team-Bewertung berücksichtigt die Offensiv-Coverage mit den tatsächlichen Angriffstypen nach Item-Effekten. — Quelle: [HA §6] — Nachweis: –
- ❌ **R-119** [P4] Die Team-Bewertung berücksichtigt defensive Schwächen mit allen Multiplikatoren (0×, 0,25×, 0,5×, 1×, 2×, 4×) und geteilte Schwächen. — Quelle: [HA §6] — Nachweis: –
- ❌ **R-120** [P4] Die Team-Bewertung berücksichtigt den Trait-Fortschritt und die Synergie mit Relikten und Items. — Quelle: [HA §6] — Nachweis: –
- ❌ **R-121** [P4] Vorausschau: Der nächste Boss (Arena, Top 4, Champ, Tower-Gegner) ist mit Typen und Team bekannt, aus der Boss-Vorschau des Spiels oder aus `core/data`. Der Bot bereitet das eigene Team gezielt darauf vor. — Quelle: [HA §6] — Nachweis: –
- ❌ **R-122** [P4] Bei der Routenwahl bewertet der Bot ganze Pfade auf der Karte, nicht nur den nächsten Knoten. — Quelle: [HA §6] — Nachweis: –
- ❌ **R-123** [P4] Der Wert eines Knotens hängt vom Teamzustand ab: XP, wenn das Team zu schwach ist. Heilung, wenn KP knapp sind. Shop, wenn Geld da ist. Tausch, wenn ein Slot entbehrlich ist. Items, die zum Matchup passen. — Quelle: [HA §6] — Nachweis: –
- ❌ **R-124** [P4] Risiko und Ertrag werden je Pfad abgewogen, abhängig vom gewählten Profil. — Quelle: [HA §6] — Nachweis: –
- ❌ **R-125** [P4] Ob gefangen oder übersprungen wird, entscheidet die Team-Bewertung vorher und nachher. — Quelle: [HA §6] — Nachweis: –
- ❌ **R-126** [P4] Bei „Team Full“ entscheidet die Team-Bewertung vorher und nachher über Ersetzen oder Behalten. Die Wahl des ersetzten Slots ist begründet. — Quelle: [HA §6] — Nachweis: –
- ❌ **R-127** [P4] Im Nuzlocke-Modus gelten „ein Fang pro Zone“ und Permadeath strikt, und der Bot spielt deutlich vorsichtiger, belegt durch einen Test zur höheren Risikoaversion. — Quelle: [HA §6] — Nachweis: –
- ❌ **R-128** [P4] Items und Relikte werden nach Wirkung, Anwendungsbereich und Träger bewertet. — Quelle: [HA §6] — Nachweis: –
- ❌ **R-129** [P4] Item-Boni zählen nur, wenn die passende Attacke wirklich genutzt wird. — Quelle: [HA §6] — Nachweis: –
- ❌ **R-130** [P4] Früh werden XP-Items wie das Glücks-Ei bevorzugt. — Quelle: [HA §6] — Nachweis: –
- ❌ **R-131** [P4] Items gehen an den richtigen Träger. — Quelle: [HA §6] — Nachweis: –
- ❌ **R-132** [P4] Ein Tausch wird nur angenommen, wenn die Team-Bewertung danach messbar besser ist. Die Schwelle steht in der Konfiguration. — Quelle: [HA §6] — Nachweis: –
- ❌ **R-133** [P4] Kampfreihenfolge vor jedem Kampf: Der beste Konter für den ersten Gegner kommt nach vorn. — Quelle: [HA §6] — Nachweis: –
- ❌ **R-134** [P4] Kampfreihenfolge: Vorn wird keine gleiche Schwäche gestapelt. — Quelle: [HA §6] — Nachweis: –
- ❌ **R-135** [P4] Kampfreihenfolge: Der Carry wird geschützt. — Quelle: [HA §6] — Nachweis: –
- ❌ **R-136** [P4] Shop/Pokémart folgt einer Budget-Logik. — Quelle: [HA §6] — Nachweis: –
- ❌ **R-137** [P4] Im Battle Tower wird sinnvoll in EVs bzw. Vitamine investiert. — Quelle: [HA §6] — Nachweis: –
- ❌ **R-138** [P4] Starter- und Regionswahl sind konfigurierbar. Standard ist eine sichere, ausgewogene Wahl, begründet in `docs/STRATEGY.md`. — Quelle: [HA §6] — Nachweis: –
- ❌ **R-139** [P4] Es gibt die Strategieprofile Sicher, Ausgewogen und Aggressiv. — Quelle: [HA §6] — Nachweis: –
- ❌ **R-140** [P4] Alle Gewichte liegen zentral in einer Konfiguration, ohne verstreute Magic Numbers in der Strategie (per Check belegt). — Quelle: [HA §6] — Nachweis: –
- ❌ **R-141** [P4] Lernen aus Daten: Das Ergebnis jeder Entscheidung wird zusammen mit dem Run-Ausgang gespeichert. — Quelle: [HA §6] — Nachweis: –
- ❌ **R-142** [P5] Eine Auswertung zeigt, welche Entscheidungen mit Siegen oder Niederlagen zusammenhängen. Sie ist in der Oberfläche abrufbar. — Quelle: [HA §6] — Nachweis: –
- ❌ **R-143** [P5] Die Gewichte lassen sich vorsichtig nachjustieren, nur mit Bestätigung und mit Rückgängig. — Quelle: [HA §6] — Nachweis: –
- ❌ **R-144** [P7] Optional: ein eigenes Modul als Löser für das Daily Pokésort (6 Pokémon so ordnen, dass jede Verbindung passt). — Quelle: [HA §6], [HA §1] — Nachweis: –

## H. Fair Play, Sicherheit und Datenschutz
- ❌ **R-013** [P3] Der Bot spielt nur über die normale Oberfläche, wie ein Mensch, mit menschenähnlichen Pausen über die Tempo-Einstellung. — Quelle: [HA §6] „Fair Play“ (ursprünglich [eigene Idee]) — Nachweis: –
- ❌ **R-145** [P3] Keine Manipulation von Speicherständen, localStorage des Spiels, Netzwerkanfragen, Account- oder Hall-of-Fame-Daten. Ein Check belegt, dass es keinen Schreibzugriff auf den Spiel-Storage gibt und kein Patchen von fetch oder XHR. — Quelle: [HA §6] — Nachweis: –
- ❌ **R-146** [P3] Keine massenhaften Anfragen an den Server. Der Bot löst nur Anfragen aus, die auch ein Mensch per Klick auslöst. — Quelle: [HA §6] — Nachweis: –
- ❌ **R-147** [P3] Der Bot klickt niemals „Reset Run“, Löschen oder Logout, außer es ist in den Einstellungen ausdrücklich erlaubt. Standard ist verboten, ein Test mit Fixture belegt das. — Quelle: [HA §6] — Nachweis: –
- ❌ **R-148** [P3] Datenschutz: Der Bot liest, loggt und exportiert niemals Zugangs- oder Personendaten des Spiels, z. B. `poke_save_token`, `poke_save_owner`, `poke_username` und Spieler-IDs. Debug-Infos, Log-Exporte und Fixtures sind bereinigt, belegt durch einen Test. — Quelle: [eigene Idee] Der Spielstand des Nutzers enthält ein Cloud-Save-Token. — Nachweis: –

## I. Oberfläche
- ❌ **R-149** [P5] Das Overlay auf der Spielseite ist bei beiden Varianten die Hauptbedienung. — Quelle: [HA §7] — Nachweis: –
- ❌ **R-150** [P5] Vorn, groß und sofort sichtbar stehen Start/Pause, was der Bot gerade tut und warum, der Team-Zustand und der Fortschritt. — Quelle: [HA §7] — Nachweis: –
- ❌ **R-151** [P5] Einstellungen, Log und Statistik liegen aufgeräumt dahinter, in Tabs oder ausklappbaren Bereichen. — Quelle: [HA §7] — Nachweis: –
- ❌ **R-152** [P5] Das Overlay nutzt Shadow DOM, damit sich Spiel- und Bot-CSS nicht gegenseitig beeinflussen, belegt durch einen Test. — Quelle: [HA §7] — Nachweis: –
- ❌ **R-153** [P5] Das Overlay lässt sich mit Maus und Finger ziehen. — Quelle: [HA §7] — Nachweis: –
- ❌ **R-154** [P5] Das Overlay lässt sich zu einer kleinen Pille minimieren. — Quelle: [HA §7] — Nachweis: –
- ❌ **R-155** [P5] Das Overlay lässt sich an den Rändern andocken. — Quelle: [HA §7] — Nachweis: –
- ❌ **R-156** [P5] Position und Minimiert-Zustand werden gespeichert und nach dem Neuladen wiederhergestellt. — Quelle: [HA §7] — Nachweis: –
- ❌ **R-002** [P5] Die Bot-Oberfläche verdeckt in keinem Spielbildschirm einen wichtigen Spielbutton und macht keinen unklickbar. Ein automatischer Test prüft das über die Überschneidung der Bounding-Boxen und `elementFromPoint`, Screenshots belegen es. — Quelle: [EA] „verdeckte Spielbuttons“, [HA §7] — Nachweis: –
- ❌ **R-157** [P5] Steuerung: Start, Pause, Stopp. — Quelle: [HA §7] — Nachweis: –
- ❌ **R-011** [P3] Pause und Stopp greifen sofort, auch mitten in einer Aktion (Not-Aus). — Quelle: [eigene Idee], ergänzt [HA §7] — Nachweis: –
- ❌ **R-158** [P5] Einzelschritt: Der Bot führt genau eine Entscheidung aus und pausiert dann. — Quelle: [HA §7] — Nachweis: –
- ❌ **R-159** [P5] Im „Nur vorschlagen“-Modus hebt der Bot die empfohlene Option im Spiel hervor und zeigt die Begründung, klickt aber nicht. — Quelle: [HA §7] — Nachweis: –
- ❌ **R-160** [P5] Einstellung Modus: Story Classic oder Nuzlocke, Region, Battle Tower mit Stufe und Schwierigkeit, Challenge. — Quelle: [HA §7] — Nachweis: –
- ❌ **R-161** [P5] Einstellung Strategieprofil. — Quelle: [HA §7] — Nachweis: –
- ❌ **R-162** [P5] Einstellung Tempo: ein Verzögerungsbereich mit Zufallsanteil. — Quelle: [HA §7] — Nachweis: –
- ❌ **R-163** [P5] Stopp-Bedingungen: nach N Runs, bei Champ-Sieg, bei Shiny, bei Niederlage, nach Zeit. — Quelle: [HA §7] — Nachweis: –
- ❌ **R-164** [P5] Einstellung Ton an/aus. — Quelle: [HA §7] — Nachweis: –
- ❌ **R-165** [P5] Einstellung, welche riskanten Aktionen erlaubt sind, z. B. „Reset Run“ (R-147). — Quelle: [HA §7] — Nachweis: –
- ❌ **R-166** [P5] Autostart nach dem Seitenladen, Standard: aus. — Quelle: [HA §7] — Nachweis: –
- ❌ **R-167** [P5] Zu jeder Einstellung gibt es eine kurze Erklärung und einen sinnvollen Standardwert. — Quelle: [HA §7] — Nachweis: –
- ❌ **R-168** [P5] Die Live-Anzeige zeigt den aktuellen Bildschirm bzw. Knoten, das Team mit KP und Level, den nächsten Boss und die letzte Entscheidung samt Begründung. — Quelle: [HA §7] — Nachweis: –
- ❌ **R-169** [P5] Die Statistik zeigt Runs, Siege, Siegquote, Rekord und Laufzeit. Sie bleibt über das Neuladen erhalten [eigene Idee]. — Quelle: [HA §7] — Nachweis: –
- ❌ **R-170** [P5] Log mit Filter. — Quelle: [HA §7] — Nachweis: –
- ❌ **R-171** [P5] Logs und Einstellungen lassen sich als JSON exportieren und importieren. Beim Import wird validiert, und fehlerhafte Dateien werden verständlich abgelehnt [eigene Idee]. — Quelle: [HA §7] — Nachweis: –
- ❌ **R-172** [P5] Fehlermeldungen sind in Alltagssprache formuliert, z. B. „Unbekannter Bildschirm erkannt, Bot pausiert. Bitte einmal von Hand weiterklicken.“ — Quelle: [HA §7] — Nachweis: –
- ❌ **R-173** [P5] Knopf „Debug-Infos kopieren“, bereinigt nach R-148. — Quelle: [HA §7] — Nachweis: –
- ❌ **R-174** [P5] Deutsch ist Standard, Englisch lässt sich umschalten. Alle Texte laufen über i18n, ein Test meldet fehlende Übersetzungen. — Quelle: [HA §7] — Nachweis: –
- ❌ **R-175** [P5] Die Tastenkürzel auf dem Desktop sind konfigurierbar. — Quelle: [HA §7] — Nachweis: –
- ❌ **R-176** [P5] Auf iOS ist alles per Tippen bedienbar, keine Funktion geht nur per Tastatur oder Hover. — Quelle: [HA §7] — Nachweis: –
- ❌ **R-001** [P5] Die Bot-Oberfläche ist auf Desktop (1440×900) und iPhone (390×844) voll bedienbar. Für jeden UI-Zustand gibt es einen aktuellen Playwright-Screenshot in beiden Größen. — Quelle: [EA], [HA §7] — Nachweis: –
- ❌ **R-003** [P5] Auf dem iPhone ist die Oberfläche mit dem Daumen bedienbar: Touch-Ziele mindestens 44×44 pt, häufige Aktionen in der Daumenzone, keine Funktion nur per Hover. — Quelle: [EA] „Daumen-Bedienung“, [HA §7]. Die Maße sind eine eigene Konkretisierung nach Apple HIG. — Nachweis: –
- ❌ **R-004** [P5] Übersicht, Hierarchie, Lesbarkeit und Abstände erfüllen alle Kriterien aus `docs/UI.md`. Der ui-reviewer meldet keinen P0- oder P1-Mangel. — Quelle: [EA] — Nachweis: –
- ❌ **R-005** [P5] Die Oberfläche funktioniert auch auf kleinen iPhones (Playwright `iPhone SE`, 375×667) und hält die Safe Areas ein (Notch, Home-Indicator). — Quelle: [eigene Idee], [HA §7] „Safe Areas/Notch beachtet“ — Nachweis: –
- ❌ **R-177** [P5] Das Design-System steht in `docs/UI.md`: Farbpalette passend zum dunklen Spiel-Look mit einer Akzentfarbe, Statusfarben (läuft, pausiert, Fehler), höchstens 3–4 Schriftgrößen, Abstände 4/8/12/16/24 px, runde Ecken, dezente Schatten, Icons als Inline-SVG, sanfte Übergänge, klare Hierarchie, viel Luft. — Quelle: [HA §7] — Nachweis: –
- ❌ **R-178** [P5] Die Oberfläche wird mit dem Plugin frontend-design gestaltet. — Quelle: [HA §7] — Nachweis: –
- ❌ **R-179** [P5] Zwei bis drei deutlich unterschiedliche Entwürfe als HTML-Mockups, mit Playwright-Screenshots (Desktop 1440×900, iPhone 390×844). Sie werden selbst angesehen und ehrlich bewertet, der beste wird gewählt, die Begründung steht in DECISIONS.md. — Quelle: [HA §7] — Nachweis: –
- ❌ **R-180** [P5] Nach der Umsetzung wird JEDER Zustand gescreenshottet: eingeklappt, läuft, pausiert, Fehler, Einstellungen, Log, Statistik, erster Start ohne Daten. — Quelle: [HA §7] — Nachweis: –
- ❌ **R-181** [P5] Jeder Zustand wird kritisch geprüft: Ist er sofort verständlich? Ist etwas abgeschnitten, gequetscht oder zu klein? Ist er mit einem Daumen bedienbar? Sind Safe Areas und Notch beachtet? — Quelle: [HA §7] — Nachweis: –
- ❌ **R-182** [P5] Es gibt mindestens zwei Verbesserungsrunden mit dem ui-reviewer, dokumentiert in PROGRESS.md. — Quelle: [HA §7] — Nachweis: –
- ❌ **R-183** [P5] Die finalen Screenshots liegen in `docs/screenshots/`. — Quelle: [HA §7], [HA §9] — Nachweis: –

## J. Tests und Qualität
- ❌ **R-184** [P4] Jede Strategiefunktion hat Unit-Tests mit konkreten Szenarien. — Quelle: [HA §8] — Nachweis: –
- ❌ **R-185** [P4] Getestete Grenzfälle: Team voll, alle KP niedrig, Nuzlocke-Tod, kein Geld, Item ohne passende Attacke, unbekanntes Pokémon oder Item. — Quelle: [HA §8] — Nachweis: –
- ❌ **R-186** [P3] Der ScreenDetector wird gegen alle Fixtures getestet. — Quelle: [HA §8] — Nachweis: –
- ❌ **R-187** [P6] E2E: Chrome mit geladener Erweiterung spielt echte Runs auf pokelike.xyz. — Quelle: [HA §8] — Nachweis: –
- ❌ **R-188** [P6] E2E: Das Userscript mit GM-Shim spielt in Chromium echte Runs. — Quelle: [HA §8] — Nachweis: –
- ❌ **R-189** [P6] E2E: Das Userscript mit GM-Shim spielt in WebKit echte Runs, mit iPhone-Emulation und aktivem Touch. — Quelle: [HA §8] — Nachweis: –
- ❌ **R-190** [P3] Mindestens ein vollständiger Story-Run bis Champ oder Game Over ohne Hänger, mit Log unter `runs/`. In Phase 6 folgt derselbe Nachweis für alle drei E2E-Varianten. — Quelle: [HA §8] — Nachweis: –
- ❌ **R-191** [P4] Die Siegquote wird über mehrere Runs gemessen, die Logs werden ausgewertet, die Strategie wird gezielt verbessert. Vorher und Nachher sind in `docs/STRATEGY.md` dokumentiert. — Quelle: [HA §8] — Nachweis: –
- ❌ **R-007** [P3] Die Logs echter Runs gegen das echte pokelike.xyz, nicht nur simulierter Runs, liegen bereinigt im Repo unter `runs/` und lassen sich auswerten. — Quelle: [EA] — Nachweis: –
- ❌ **R-008** [P4] Der Bot trifft keine dummen oder riskanten Entscheidungen. Der strategy-reviewer findet in den Logs der letzten echten Runs keinen P0- oder P1-Fund. — Quelle: [EA] — Nachweis: –
- ❌ **R-009** [P3] Zu jedem Run gibt es eine Zusammenfassung mit Ergebnis, erreichtem Fortschritt (Orden, Map, Stufe), Dauer, Spielversion, Modus, Profil und Todesursache bzw. Abbruchgrund. — Quelle: [eigene Idee] Ohne sie lässt sich Strategie-Fortschritt nicht messen. — Nachweis: –
- ❌ **R-192** [P2] Ein automatischer Check belegt, dass das Userscript-Bundle keine APIs außerhalb der erlaubten Schnittmenge nutzt. — Quelle: [HA §8] — Nachweis: –
- ❌ **R-193** [P2] Ein automatischer Check belegt, dass der Metadaten-Block korrekt ist (R-103 bis R-105). — Quelle: [HA §8] — Nachweis: –
- ❌ **R-194** [P6] Fehlerresistenz beim Seiten-Reload mitten im Run: Der Bot erkennt das Resume und setzt fort, belegt per E2E. — Quelle: [HA §8] — Nachweis: –
- ❌ **R-195** [P6] Fehlerresistenz bei Spiel-Updates mit geänderten Texten oder Klassen: Selektoren arbeiten über Text und Rolle statt über fragile Klassen und haben Fallbacks. Getestet wird mit veränderten Fixtures. — Quelle: [HA §8] — Nachweis: –
- ❌ **R-196** [P6] Fehlerresistenz bei langsamem Netz, per E2E mit Netzwerkdrosselung. — Quelle: [HA §8] — Nachweis: –
- ❌ **R-197** [P6] Fehlerresistenz bei Tab im Hintergrund, per E2E. — Quelle: [HA §8] — Nachweis: –
- ❌ **R-198** [P6] Fehlerresistenz, wenn das iOS-Display aus- und wieder angeht, simuliert über `visibilitychange`/`pagehide` in WebKit. — Quelle: [HA §8] — Nachweis: –
- ❌ **R-199** [P2] Keine stillen Fehler und keine leeren catch-Blöcke, erzwungen durch eine ESLint-Regel. — Quelle: [HA §8] — Nachweis: –
- ❌ **R-200** [P3] Alles Unerwartete wird geloggt und in der Oberfläche gemeldet. — Quelle: [HA §8] — Nachweis: –

## K. Lieferung und Dokumentation
- ❌ **R-201** [P2] Es gibt die npm-Skripte `npm run build` (beide Ziele), `npm run build:chrome`, `npm run build:userscript`, `npm test` und `npm run e2e`. — Quelle: [HA §9] — Nachweis: –
- ❌ **R-202** [P7] `dist/chrome/` lässt sich entpackt laden, dazu gibt es ein zip. — Quelle: [HA §9] — Nachweis: –
- ❌ **R-203** [P7] `dist/pokelike-bot.user.js` und `dist/pokelike-bot.meta.js` sind eingecheckt. Ein HTTP-Abruf nach dem Push belegt, dass die GitHub-raw-Links funktionieren. — Quelle: [HA §9] — Nachweis: –
- ❌ **R-204** [P7] `@version` wird bei jedem Release erhöht. Ein Check belegt, dass die Version in Bundle, `.meta.js`, `manifest.json` und `package.json` identisch und höher als beim letzten Release ist. — Quelle: [HA §9] — Nachweis: –
- ❌ **R-205** [P7] Die README ist auf Deutsch und behandelt Installation in Chrome und auf dem iPhone (Userscripts), Updates, Bedienung, Einstellungen, Fehlerbehebung und bekannte Grenzen. — Quelle: [HA §9] — Nachweis: –
- ❌ **R-206** [P7] Die Lieferung umfasst `docs/GAME_RECON.md`, `docs/STRATEGY.md`, `docs/UI.md`, `docs/screenshots/` und `CHANGELOG`, alles vollständig und aktuell. — Quelle: [HA §9] — Nachweis: –
- ❌ **R-207** [P4] `docs/STRATEGY.md` erklärt, wie und warum der Bot entscheidet. — Quelle: [HA §9] — Nachweis: –
- ❌ **R-208** [P2] Das CHANGELOG wird ab dem ersten Build gepflegt. — Quelle: [HA §9] — Nachweis: –

## L. Repo-Sicherheit
- ✅ **R-209** [P0] Das ganze Repo ist inklusive Git-Verlauf auf Passwörter, API-Keys, Tokens und persönliche Daten geprüft, das Ergebnis hat der Nutzer bekommen. — Quelle: [HA Schluss] — Nachweis: Scan in Session 1 (2026-11-25) mit `detect-secrets` (Arbeitsverzeichnis) und eigenem Regex-Scan über alle 18 Blobs der Historie, alle Dateien und alle Commit-Metadaten. Geprüft wurde auf private Schlüssel, AWS-, GitHub-, Slack-, Google- und OpenAI/Anthropic-Keys, JWT, Passwort- und Secret-Zuweisungen, lange Hex-Werte, UUIDs, E-Mails, den Save-Token-Wert und den Benutzernamen. **Keine Secrets gefunden.** **Einziger Personendaten-Fund:** Der Initial-Commit `c8c13a8`, von GitHub erzeugt, trägt die private Gmail-Adresse des Nutzers als Autor. Entfernen geht nur per Umschreiben des Verlaufs mit Force-Push auf `main`, das entscheidet der Nutzer (siehe PROGRESS.md). Das Ergebnis wurde dem Nutzer mitgeteilt.
- ❌ **R-210** [P7] Vor jedem Release wird dieser Scan wiederholt, per Skript (z. B. `npm run check:secrets`), auch für Fixtures, Logs und Screenshots. — Quelle: [eigene Idee] Sonst gilt die Prüfung nur für einen Zeitpunkt. — Nachweis: –
- ✅ **R-211** [P0] Der Spielstand des Nutzers liegt nur bereinigt im Repo: ohne Token, Benutzernamen, Spieler-IDs und Einwilligungsdaten (D-013). — Quelle: [eigene Idee] — Nachweis: Das Bereinigungsskript bricht bei jedem Treffer von Token-Wert, Benutzername, Owner oder Spieler-UUID ab. Der anschließende Repo-Scan (R-209) fand in `tests/fixtures/storage/user-save-v3.8-2026-11-25.sanitized.json` keine UUIDs, E-Mails, langen Hex-Tokens, Token-Werte oder Benutzernamen.

## M. Weitere eigene Ideen (Product Owner)
- ❌ **R-212** [P3] Die Erkennung funktioniert mit Spielsprache Deutsch UND Englisch, mit Fixtures in beiden Sprachen. Laut Spielstand spielt der Nutzer auf Deutsch (`language: "de"`). — Quelle: [eigene Idee] Textbasierte Selektoren würden sonst brechen. — Nachweis: –
- ❌ **R-213** [P3] Greift der Nutzer selbst ein, während der Bot läuft (Klick oder Tap im Spiel), pausiert der Bot sofort und meldet das. — Quelle: [eigene Idee] — Nachweis: –
- ❌ **R-214** [P3] Läuft beim Start schon ein Run, etwa ein Nuzlocke-Run des Nutzers, übernimmt der Bot ihn nur nach Bestätigung. — Quelle: [eigene Idee] — Nachweis: –
- ❌ **R-215** [P3] Fixture-Aufnahme: Bei einem unbekannten Bildschirm speichert der Bot einen bereinigten DOM-Snapshot samt Zustand, damit daraus ein neues Fixture werden kann. — Quelle: [eigene Idee] — Nachweis: –
- ❌ **R-216** [P5] Bot und Overlay bremsen das Spiel nicht spürbar: gedrosselter MutationObserver, keine Dauerschleifen, gemessen im E2E-Test. — Quelle: [eigene Idee] — Nachweis: –
- ❌ **R-217** [P5] Das Overlay ist per Tastatur bedienbar und hat aussagekräftige ARIA-Beschriftungen. — Quelle: [eigene Idee] — Nachweis: –
- ❌ **R-218** [P5] Das Overlay bleibt im hellen und im dunklen Spielmodus lesbar (Spieleinstellung `darkMode`). — Quelle: [eigene Idee] — Nachweis: –
- ❌ **R-219** [P3] Die StateReader-Tests nutzen den bereinigten echten Spielstand aus `tests/fixtures/storage/` als Fixture. — Quelle: [eigene Idee] — Nachweis: –

## P. Plattform und Arbeitsumgebung
- ❌ **R-015** [P2] Tests, Screenshots und Runs laufen in der Claude-Code-Cloud-Umgebung: Chromium nutzt das vorinstallierte Browser-Binary, WebKit läuft nach D-011. — Quelle: [eigene Idee] Jede Session muss selbstständig testen können. — Nachweis: –
- ❌ **R-016** [P2] Der SessionStart-Hook installiert die Projekt-Abhängigkeiten idempotent, sodass Tests in jeder neuen Session sofort laufen. — Quelle: [eigene Idee] — Nachweis: –

## Z. Arbeitsweise und Projekt-Infrastruktur
- ✅ **R-017** [P0] `CLAUDE.md` enthält Projektziel, Architektur-Überblick, alle Arbeitsregeln aus Punkt 4 des Einrichtungsauftrags und Verweise auf die Docs, kurz und präzise. — Quelle: [EA] 1 — Nachweis: `CLAUDE.md`, Regeln abgeglichen mit `docs/AUFTRAG.md` Punkt 4 (Session 1)
- 🟡 **R-018** [P0] `docs/REQUIREMENTS.md` enthält jede Anforderung des Hauptauftrags als nummerierte, prüfbare Checkliste, gruppiert nach Bereich und mit Status. Nichts ist weggelassen, nichts zu stark gekürzt. — Quelle: [EA] 1 — Nachweis: Zerlegung R-028 bis R-219 plus Zuordnungstabelle. Die Bestätigung durch den requirements-reviewer steht noch aus.
- ✅ **R-019** [P0] `docs/PROGRESS.md` (erledigt, in Arbeit, nächster Schritt, bekannte Probleme), `docs/DECISIONS.md` und `docs/PLAN.md` (Phasen mit Ziel und Abnahmekriterien) sind angelegt. — Quelle: [EA] 1 — Nachweis: Dateien vorhanden, Ausgabe des Hooks zeigt PROGRESS.md (Session 1)
- 🟡 **R-020** [P0] In `.claude/settings.json` sind `superpowers@claude-plugins-official` und `frontend-design@claude-plugins-official` über `enabledPlugins` aktiviert, mit nach code.claude.com/docs geprüfter Syntax. — Quelle: [EA] 2 — Nachweis: JSON gültig, Syntax nach settings-reference (D-001). Ausstehend: in Session 2 bestätigen, dass die Skills `superpowers:*` und `frontend-design:*` verfügbar sind.
- ✅ **R-021** [P0] Kein aktives Plugin kürzt oder schreibt Gedächtnis- oder Anforderungsdateien automatisch um. — Quelle: [EA] 2 — Nachweis: Hooks von superpowers 7.0.2 geprüft (nur ein SessionStart, der Kontext einspielt). frontend-design hat keine Hooks. Der eigene Hook ist read-only (Session 1).
- 🟡 **R-022** [P0] Die Subagenten `requirements-reviewer`, `ui-reviewer` und `strategy-reviewer` liegen in `.claude/agents/` mit den geforderten Prüfaufträgen. — Quelle: [EA] 3 — Nachweis: Dateien mit gültigem YAML-Frontmatter. Ausstehend: in Session 2 bestätigen, dass sie als Agententyp aufrufbar sind.
- ✅ **R-023** [P0] Ein SessionStart-Hook in `.claude/settings.json` gibt beim Start den Stand aus PROGRESS.md und die offenen Punkte aus REQUIREMENTS.md aus. — Quelle: [EA] 3 — Nachweis: manueller Lauf `CLAUDE_PROJECT_DIR=$PWD .claude/hooks/session-start.sh` in Session 1. Die Ausgabe enthält PROGRESS-Abschnitte, die offenen Punkte der aktuellen Phase und die IDs aller übrigen offenen Punkte.
- ✅ **R-024** [P0] Jeder abgeschlossene Schritt wird committet und nach `main` gepusht. Geht das nicht, wird am Session-Ende ein PR nach `main` geöffnet und der Nutzer informiert. — Quelle: [EA] 4 — Nachweis: Session 1 hat Commit `6bb73a4` per Fast-Forward nach `main` gepusht, der Push nach `main` ist in dieser Umgebung also erlaubt. Dieser Punkt ist eine Daueranforderung, die Reviewer prüfen ihn in jeder Session neu.
- ✅ **R-025** [P0] `docs/UI.md` legt prüfbare UI-Kriterien, Viewports und Screenshot-Konventionen für den ui-reviewer fest. Das Design-System folgt in P5 (R-177). — Quelle: [eigene Idee] Der ui-reviewer verlangt `docs/UI.md`, die Datei gab es aber noch nicht. — Nachweis: `docs/UI.md`
- ✅ **R-026** [P0] Die Originaltexte der Aufträge stehen wörtlich in `docs/AUFTRAG.md`, damit beim Zerlegen nichts verloren geht. — Quelle: [eigene Idee] — Nachweis: `docs/AUFTRAG.md` enthält Einrichtungsauftrag und Hauptauftrag (Session 1)
- 🟡 **R-027** [P1] `docs/GAME_RECON.md` (vormals `docs/GAME.md`) sammelt geprüftes Spielwissen über Pokelike und dient als Grundlage für Bot und strategy-reviewer. — Quelle: [eigene Idee], [HA §2] — Nachweis: Vorab-Befunde vom 2026-11-25 (Hauptmenü headless, CSP-Header, Struktur des Spielstands). Die Aufklärung selbst ist Phase 1.

---

## Zuordnung Hauptauftrag → R-IDs
| Abschnitt im Hauptauftrag | R-IDs |
|---|---|
| Ziel (selbstständig, effizient, klug, zwei Build-Ziele, keine Safari-Web-Extension) | R-028–R-035, R-014 |
| §1 Spielwissen (live prüfen, Modi, Ablauf, Bildschirme, Mechaniken, Quellen) | R-036–R-064 |
| §2 Aufklärung | R-065–R-077, R-012 |
| §3 Architektur | R-078–R-097, R-010, R-006, R-032 |
| §4 Userscript-Regeln | R-098–R-109 |
| §5 Chrome-Extras | R-110–R-115 |
| §6 Strategie inkl. Fair Play und Pokésort | R-116–R-144, R-013, R-145–R-147 |
| §7 Oberfläche inkl. Design-Prozess | R-149–R-183, R-001–R-005, R-011, R-074 |
| §8 Tests und Qualität | R-184–R-200, R-007, R-009 |
| §9 Lieferung | R-201–R-208 |
| Schluss: Repo-Prüfung vor Public | R-209 |
| Eigene Ideen | R-148, R-210–R-219, R-005, R-009, R-011, R-015, R-016, R-025–R-027 |
