# Review-Tor P2: ui-reviewer und strategy-reviewer (2026-11-26)

Beide Urteile für P2: **nicht anwendbar**. P2 hat weder Oberfläche noch Strategie geändert, und keiner der Funde blockiert P2. Diese Datei sichert die Funde als Vorbefunde für P3 bis P5, denn die Screenshots und Logs unter `artifacts/` sind gitignored und verschwinden mit dem Container. Bezugsstand ist HEAD `5132ac5`.

## ui-reviewer

**Gemessen:**
- 80 Overlay-Screenshots: 10 Zustände × 4 Viewports × hell/dunkel, dazu 3 der Chrome-Erweiterung (Stub-Spiel, deviceScaleFactor 1).
- Für jedes Element `getBoundingClientRect`, `getComputedStyle`, `elementFromPoint` und `scrollWidth`.

**Regression durch P2:**
- keine: Layout unverändert, kein horizontales Scrollen (83/83), Log-Zeilen brechen sauber um
- Die Viewports entsprechen UI.md §1.

**Behobene P2-Funde:**
- „handled error“ erschien orange wie echte Warnungen. Behoben (`a7c38dc`): Es erscheint jetzt als `debug`, gedämpft und mit Meldung.
- Nur-Fallback-Fehler nur beim Totalausfall melden: das kommt mit R-253.

**Vorbefunde P5:**

| Prio | Fund | Fix-Idee | R-ID |
|---|---|---|---|
| P0 | `<select>` und Checkboxen sind im hellen Modus auf WebKit unlesbar (Kontrast 1,30:1). Ursache: Das Spiel setzt `color-scheme: dark`, das Panel setzt nichts | `.panel{color-scheme:…}` passend zum Thema, `appearance:none` mit eigenem Pfeil, `accent-color` | R-217, R-218 |
| P0 | Das Panel verdeckt 44–58 % der iPhone-Fläche. `elementFromPoint` trifft Overlay statt Spielknopf (iPhone 390×844: 31 Ziele, eingeklappt 11) | Pille ≤ 56×56, an den Rand andocken, Test mit Fixtures inkl. Spiel-CSS | R-002, R-155 |
| P0 | Es gibt keinen Screenshot-Befehl, Zustände nicht reproduzierbar belegbar | `npm run screenshots` (Vorlage: Skript des Reviewers unter artifacts/ui-review, neu schreiben) | R-180, R-001 |
| P1 | Touch-Ziele 29–62×32 px, Checkboxen 12×12, Abstände 5–6 px | ≥ 44×44, ≥ 8 px Abstand | R-164 ff. |
| P1 | Start/Pause springt zwischen 8 % und 54 % der Höhe | feste Fußleiste | R-151 |
| P1 | Eingeklappt gibt es keinen Pause-Knopf, „▢“ ist mehrdeutig | Pille mit Status und Pause | R-155 |
| P1 | Keine Safe Area, `100vh` | `env(safe-area-inset-bottom)`, `100dvh` mit Fallback (Safari 15.0!) | R-220 |
| P1 | Schrift 13/11 px, auf dem iPhone verlangt sind 16/12 px | Typo-Skala | UI.md §3a |
| P1 | Warnfarbe hell #b26a00 hat nur 3,99:1 | z. B. #8a5200 | UI.md §3a |
| P1 | Leere Checkbox sieht aus wie „an“ (wie P0-1) | wie P0-1 | R-217 |
| P1 | Fehlerzustand nicht von Hinweisen unterscheidbar, Texte englisch und technisch | eigene Fehlerkarte, deutscher Text mit nächstem Schritt | R-172, R-174 |
| P1 | Hierarchie: Status klein, „Schneller spielen“-Box davor, zwei Primärknöpfe | Status oben, Hinweis nachrangig | R-150 |
| P1 | Bei offenen Einstellungen läuft der Inhalt über (scrollWidth 337–339 gegenüber 328) | Breiten prüfen. Der E2E-Test „no horizontal scroll“ prüft nur `left`/`right` | R-005 |
| P1 | Fachjargon (autoSkipBattles …), Sprachmix, `prefers-color-scheme` statt Spieleinstellung `darkMode` | Texte, Theme nach dem Spiel | R-174, R-218 |
| P2 | Zeitstempel vorgemerkter Fehler = Bot-Start statt `e.t` | `e.t` übernehmen | R-253 |
| P2 | Raster-Ausreißer 10/6/2 px, Tasten-Hinweis auf dem iPhone, Toast oben mittig im Spiel-DOM, Uhrzeit abhängig von der Locale, Projektnamen ≠ UI.md-Namen | Feinschliff | P5 |
| Kompatibilität | `:focus-visible` ab Safari 15.4 (Build-Warnung, R-107) | `@supports selector(:focus-visible)` oder `:focus` als Fallback | R-107, P5 |

**Fehlende Zustände und Screenshots:**
- Pille, Statistik, „Nur vorschlagen“, Stopp, erster Start
- alle Spielbildschirme in hell und dunkel
- Titel und Karte mit echtem Spiel-CSS
- Englisch
- iPhone im Querformat

## strategy-reviewer

**Datenbasis:** Live-Lauf 3 (2026-11-25, Story Classic Kanto, frisches Profil). 150 s, 4 Orden, Abbruch durch den SKIP-Hänger bei Erika. Lauf 1 und 2 zum Vergleich.

| Prio | Fund | Fix und Test | Phase, R-ID |
|---|---|---|---|
| P0 | Keine prüfbaren Run-Logs: Das Overlay-Log hat nur 60 Zeilen, keine `data`, keine Optionen und Scores | D-005-Logs unter `runs/`. Sofort möglich: Der Live-Test exportiert den vollen Logger statt `#pk-log` | P3, R-006, R-009 |
| P0 | SKIP-Hänger am Kampfende: Auch normale Kämpfe lösen „attempt 1/3“ aus. Erika dauert 15–17 s. Alle 3 Läufe enden bei Erika, D-027 ist unerreichbar | gesperrtes SKIP nie klicken, Warten zählt nicht als Fehlschlag, Kampffortschritt in der Signatur, Kampfdauer loggen. Fixture `#btn-auto-battle[disabled]` → `wait` | P3, R-087, R-094, R-190 |
| P1 | Ein angeschlagener Carry führt weiter, auf der Karte wird die Reihenfolge nie geändert (mit Simulation laufen weder `jointOrder` noch `leadSwap`). STRATEGY.md:43 beschreibt also Verhalten, das live nie vorkommt | Lead < 40 % KP und Ersatz ≥ 70 % KP mit Level ≥ Lead − 5 → tauschen, oder 2–3 Reihenfolgen mitsimulieren. Fixture Ivysaur 20/80, Psyduck 75/75 | P4, R-117, R-133, R-135 |
| P1 | Die Stillstandserkennung hat blinde Flecken: Hänger in den letzten 4 min, Top-4-Kette am selben Knoten, 4 min nicht gemessen | **neu R-254** | P3 |
| P1 | Sachliche Fehler („map nodes do not match game data“, „no usable button“ …) zählen als gewollte Pause | Pausen typisieren, **R-254** | P3 |
| P2 | Boss-Reihenfolge wird bei 100 % nicht optimiert (Venusaur fällt gegen Erika) | Ziel = Siegquote − λ·P(Carry fällt) | P4, R-133, R-135 |
| P2 | Zwei weitere Kämpfe mit besiegtem Carry vor dem Pokécenter (93 %) | R-251 auch bei besiegtem Carry, im Profil „Ausgewogen“ zuerst nach Erfolgsquote | P4, R-124, R-139, R-251 |
| P2 | Fangwahl ohne Signal bei Sättigung (alles 100/95 %), Schwächen gegen den nächsten Boss gestapelt (Omanyte 4× Pflanze) | härteres Szenario, Typdeckung, geteilte Schwächen | P4, R-119, R-121, R-125, R-134 |
| P2 | Zwei Modelle für denselben nächsten Boss (95 % gegenüber 42 %). Live-Indiz: Das Spiel heilt beim Kartenwechsel | im Spielcode prüfen, ein gemeinsames Modell | P3 Aufklärung, P4 Umsetzung |
| P2 | Prognose-Rauschen (63 % → 43 % ohne Zustandsänderung) steuert die Route | R-250 | P4 |
| P2 | Ø-Level-Bewertung bestraft Fänge | A/B mit D-005-Logs | P4, R-123, R-125 |
| P2 | Begründungen nennen nur den Gewinner, `#pk-decision` ist veraltet | R-006, R-116 | P3 |
| P2 | Status wird über Text erkannt (bricht mit i18n), `screens` per 2-s-Stichprobe übersieht kurze Bildschirme | `data-status`, Bildschirmwechsel vom Bot loggen | P3/P5 |

**Gute Entscheidungen:**
- Bisasam als Starter
- früher Fang Psyduck gegen Brock
- Pokécenter nach dem Ausfall des Carrys
- keine Pokédollar-Ausgaben, kein Reset

**Offene Spielwissen-Fragen (GAME_RECON, P3):**
- Heilung bzw. Wiederbelebung beim Kartenwechsel
- §12.8 ergänzen: auch normale Kämpfe, Erika 15–17 s
- `getBestMove` bei Doppeltypen
- Dauer der Top-4-Kämpfe
- Regel für die 3 Fangangebote
