# Changelog

Alle nennenswerten Änderungen am Bot. Format nach [Keep a Changelog](https://keepachangelog.com/de/1.1.0/), Versionen nach [SemVer](https://semver.org/lang/de/). Die Version steht in `package.json` und wird in Manifest und Userscript übernommen (R-204, R-208).

## [Unreleased]

### Geändert (Challenge-Fokus, D-040, D-041)

- **Der Bot spielt nur noch Challenges.** Sind Challenges im Spielstand gesperrt, pausiert er mit einem Hinweis.
- **Neues Overlay:**
  - Status in Wort und Farbe, ein großer Start/Pause-Knopf.
  - Run-Karte mit Etappen-Leiste (9 Felder), nächstem Boss, simulierter Chance und Team.
  - Auf dem iPhone unten angedockt, eingeklappt nur eine kleine Pille.
- **Einstellungen nur noch für Challenges:** Challenge-Art, Orden-Stufe, Starter, Neustart und Anzahl der Runs. Seltenes liegt unter „Erweitert“.
- **Spielstärke:** Bei sicheren Bossen fängt der Bot die stärkere Art statt einer schwachen.
- **Live-Funde behoben:** Ist ein Attacken-Lehrer ohne lernfähiges Mitglied, überspringt der Bot ihn. Den Bildschirm „Neues Pokémon!“ (Legendären-Knoten) nimmt er an.
- **Liga** (D-043): Vor jedem Liga-Kampf simuliert der Bot nur noch die verbleibenden Gegner. Er stellt das Team so um, dass es am weitesten kommt, statt ein angeschlagenes Mitglied vorne zu lassen.
- **Carry-Bauweise** (D-049): Ein Pokémon, der Starter, trägt den Run. Es bekommt Sonderbonbons, Glücks-Ei, TM und Attacken-Lehrer, dazu die Relikte, die es am Leben halten und stärker zuschlagen lassen. Fänge vom Typ des Carrys werden bevorzugt, weil sie den Typbonus stapeln.
- **Liga-Bewertung realistischer** (D-048): Der Bot rechnet mit dem Level-Fortschritt, den seine Teams wirklich machen, statt mit einer festen Annahme. Im Endlos-Modus gibt es in der Simulation keine Level-Grenze von 100 mehr, wie im Spiel.
- **Liga als Ziel** (D-044): In der Arena-Challenge bewertet der Bot Fänge und Relikte auch danach, wie weit das Team in der Liga käme. Die Liga steht schon beim Start des Runs fest.
- **Teamaufbau** (D-046, korrigiert in D-047): Ein starker Starter allein reicht für die Liga nicht. Der Bot nimmt deshalb Fang- und Legendären-Knoten mit, solange das Team nicht voll ist. Ein Fang zählt dabei etwa so viel wie ein Kampf, damit das Team nicht zu wenige Level sammelt.
- **Mega-Steine** (D-045): Der Bot ersetzt den Mega-Stein des Starters nicht mehr durch andere Items. Mega-Steine bekommt nur die passende Art, und gehaltene Items tauscht er nur gegen klar bessere.
- **Poké-Mart-Knoten** (D-042): Er sieht aus wie eine Relikt-Wahl, verkauft aber Items. Der Bot erkennt ihn am Kartenknoten und verlässt ihn, ohne etwas zu verkaufen. Den Knotentyp kannten wir bisher unter dem falschen Namen `poke_mart`.

### Hinzugefügt (Phase 3, P3c)

- **Not-Aus** (R-011): Pause wirkt sofort, auch während einer Simulation, beim Zielen eines Klicks und zwischen Tauschschritten. Nach der Pause klickt der Bot nicht mehr und drückt keine Taste mehr.
- **Unerwartete Fehler** in der Welt des Bots erscheinen als rote Zeile im Log und beim ersten Auftreten als Hinweis. Fehler des Spiels selbst werden nicht gemeldet (R-200).
- **Einstellungen, die nicht gespeichert werden können**, zeigen einen dauerhaften Hinweis mit dem nächsten Schritt im Overlay und auf der Optionsseite. Beispiele: nach einem Update der Erweiterung „Seite neu laden“, im privaten Surfen auf dem iPhone „gelten nur bis zum Neuladen“ (R-259).

### Hinzugefügt (Phase 3, P3b)

- **Run-Logs nach D-005** (R-006, R-009):
  - Jede ausgeführte Entscheidung wird mit Zustand, Optionen und Bewertungen, Wahl, Begründung, Konfidenz und Ergebnis aufgezeichnet.
  - Zu jedem Run gibt es eine Zusammenfassung mit Ergebnis, Fortschritt, Dauer, Spiel- und Bot-Version, Modus, Profil, Todesursache bzw. Abbruchgrund und Verweildauer je Bildschirm.
- **Knopf „Runs exportieren“ im Overlay:** Er lädt die Run-Logs als `pkbot-runs-<Datum>.json` herunter. Wo kein Download geht, kopiert er sie (R-006).
- **`npm run runs:import -- <datei>`:** Übernimmt einen Export nach `runs/`, nur wenn die Prüfung auf Geheimnisse nichts findet. Ein Test prüft alles unter `runs/` (R-007, R-148, R-210).
- **Fehler aus dem Spielkontext** (Bridge, Simulator) erscheinen gedämpft im Bot-Log und in den Run-Logs (R-253).
- **Pausen tragen eine Art** (`#pk-pause[data-kind]`, R-254):
  - gewollt: Nutzer, Run beendet, Einstellung passt nicht
  - nicht unterstützter Bildschirm
  - Fehler
- **Live-Test** (R-254):
  - Fortschritt auch in der Top-4-Kette und beim Team.
  - Stillstands-Budget je Bildschirm: Kampf 120 s, Karte 180 s, sonst 90 s.
  - Nachlauf am Ende, damit auch ein späterer Hänger auffällt.

### Behoben (Phase 3, Gesamt-Review P3a)

- Der Watchdog pausierte nach einer Bildschirmsperre auf dem iPhone sofort mit „stalled“. Jetzt startet er nach einer Zeitlücke neu und pausiert nur nach vorherigem Neueinlesen (R-095).
- Die Wirkungsprüfung hängt nicht mehr ewig, wenn eine Prüfung wirft (R-094).

### Behoben (Phase 3, P3a)

- **Hänger bei langen Bosskämpfen** (GAME_RECON §12.8):
  - Der Bot klickt nur noch bedienbare Knöpfe. Ein Knopf, der nach dem Klick gesperrt wird, gilt als Wirkung.
  - Laufende Kämpfe werden am KP-Fortschritt erkannt und abgewartet.
  - Live: 10 min ohne Hänger, bis zu 7 Orden (R-087, R-010).
- Die Wirkungsprüfung reagiert per MutationObserver auf Änderungen statt im festen Takt (R-094).

### Hinzugefügt (Phase 3, P3a)

- Watchdog mit Einstellung „Watchdog (s)“ (Standard 60): Er liest nach X s Stillstand neu ein und pausiert danach mit „stalled“ (R-095).

### Hinzugefügt

- `@updateURL`/`@downloadURL` im Userscript zeigen auf GitHub raw (`main/dist/…`). Sie funktionieren, sobald `dist/` zum Release eingecheckt ist (R-105, R-203).
- Fallback-Speicher des Userscripts: localStorage unter dem eigenen Präfix `pkbot.`, falls die GM-API fehlt oder scheitert. Die Einstellungen überleben dann auch ohne GM einen Reload (R-102).
- Automatische Checks:
  - Bundle- und Metadaten-Check beim Build und als `npm run check:userscript` (R-192, R-193)
  - Import-Grenzen `core/`/`ui/` ↔ `platform/` (R-032)
  - ESLint-Regel gegen stille Fehler (R-199)
  - `npm run check:docs` für die Gedächtnis-Dateien (R-246)
- Zentrale Fehlerablage `noteError` mit den letzten 50 verschiedenen Fehlern (R-199).
- E2E auf allen Viewports aus `docs/UI.md`: Desktop 1440×900, iPhone 390×844, iPhone mit Safari-Leisten, iPhone SE (R-005, R-033).
- Der SessionStart-Hook warnt vor nicht gemergten Remote-Branches (R-247).
- `docs/USERSCRIPT_API.md`: Abgleich der genutzten API mit Userscripts, Tampermonkey und Violentmonkey (R-098).

### Geändert

- Das Userscript nutzt nur noch die GM-Schnittmenge (`GM.getValue`, `GM.setValue`, `GM.setClipboard`). Die Legacy-APIs `GM_*` sind entfernt, und `@grant` wird aus der tatsächlichen Nutzung erzeugt (R-099, R-104).
- Die eingebettete Bridge ist lesbar und nicht mehr minifiziert. Userscript und Bridge zielen auf ES2020 (Safari ab iOS 15) (R-107).
- Der Live-Test wertet eine Fehler-Pause, etwa „action keeps failing“, als Fehlschlag (R-082).

### Behoben (Gesamt-Review P2)

- Scheitert im Userscript nur der GM-Schreibvorgang (etwa bei vollem Speicher), gilt nach einem Reload trotzdem die neueste Einstellung (R-100, R-102).
- Behandelte Fehler erscheinen im Overlay-Log und im Log-Export, gedämpft als `debug` statt als Warnung (R-199, D-035).
- Der Bundle-Check erkennt RegExp-Lookbehind, das vor Safari 16.4 das ganze Skript am Laden hindern würde (R-107).
- Der Live-Test wartet nicht mehr auf eine fehlende Pause-Anzeige. Er scheitert auch, wenn der Bot läuft, aber 4 min lang keinen Fortschritt macht (R-082).
- Der Hook warnt wieder, wenn ein als erledigt eingetragener Branch neue Commits bekommt (R-247).

### Behoben (Review-Tor P2)

- Import-Grenzen lassen sich nicht mehr über `globalThis.chrome`, `window.GM` oder `import()` umgehen. `src/app.ts` ist eingeschlossen (R-032).
- Keine stillen Fehler mehr in `.then`-Fehlerhandlern und bei einem fehlgeschlagenen Start: Er wird als Toast gemeldet (R-199).
- Der Kompatibilitäts-Check für Safari 15 deckt mehr APIs ab, erkennt nur echte Feature-Erkennung an und warnt bei CSS, das nur die Darstellung verschlechtert. Der Build schreibt erst nach der Prüfung (R-107).
- Der Fallback-Schlüssel heißt `pkbot.settings` statt `pkbot.pkbot.settings`. Fehlt GM, wird das einmal vermerkt (R-100, R-102).
- Der SessionStart-Hook zeigt die Kurzform der aktuellen Phase wieder vollständig. Das prüft jetzt ein Test (R-232).

### Behoben (Review-Tor P2, Runde 2)

- Keine stillen Fehler aus Promises ohne Fehlerbehandlung: typbewusste ESLint-Regeln, `noteRejection` (R-199, D-035).
- Ein Einzelschritt, der auf eine verbotene Aktion trifft, pausiert mit „blocked: …“ wie die Schleife (R-147, R-199).
- Plattform-APIs sind in `core/` und `ui/` auch über Casts, Aliase und berechnete `import()` gesperrt (R-032).
- Der Metadaten-Check lässt nur die erlaubten Schlüssel zu (R-193).
- Hook: Unterpunkte der neuesten „Erledigt“-Einträge sind sichtbar, durchgestrichener Alttext fehlt in der Kurzform, die Vollständigkeit wird geprüft (R-232, D-035).

### Bekannt

- Bei langen Bosskämpfen mit gesperrtem SKIP bleibt der Bot hängen (GAME_RECON §12.8). Der Live-Test meldet das jetzt als Fehler. Behoben wird es in Phase 3.

## [0.1.0] – 2026-11-25

Stand aus dem Vorgänger-Branch (D-016): Chrome-Erweiterung (MV3) und Userscript aus einer Codebasis, Overlay, Bildschirmerkennung über IDs, Strategie mit Kampfsimulation über das eigene `runBattle` des Spiels (eigene Seeds aus dem sichtbaren Zustand, D-019, R-248), Actor-Guard gegen Reset und Logout (R-147).
