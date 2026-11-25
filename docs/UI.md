# UI: Qualitätskriterien und Design-System

Diese Datei ist der Maßstab für den `ui-reviewer` und für `frontend-design`. Sie gilt für Overlay, Pille, Popup und Optionsseite.
Ein Kriterium gilt als erfüllt, wenn es auf **allen** Viewports und in **allen** Zuständen erfüllt ist.

## 1. Viewports (Playwright)
| Name | Einstellung | Zweck |
|---|---|---|
| `desktop` | Chromium, `viewport: 1440×900` | Desktop, vom Hauptauftrag vorgegeben |
| `iphone` | WebKit, `devices['iPhone 13']` (390×844, DPR 3, Touch) | Hauptziel mobil, vom Hauptauftrag vorgegeben |
| `iphone-se` | WebKit, `devices['iPhone SE']` (375×667) | kleinstes unterstütztes iPhone (R-005, eigene Idee) |

Hochformat ist Pflicht. Querformat auf dem iPhone wird mindestens einmal geprüft (Overlay bleibt bedienbar), ist aber kein Schwerpunkt.
Falls WebKit noch nicht läuft (D-011), dient Chromium-Emulation als Übergang. Der Screenshot muss das dann im Dateinamen tragen (`--chromium-emu`).

## 2. Screenshots
- **Arbeits-Screenshots:** `artifacts/screenshots/<bereich>/<zustand>--<viewport>.png` (gitignored). Sie werden per Skript erzeugt, nie von Hand.
- **Finale und Nachweis-Screenshots:** `docs/screenshots/<bereich>/<zustand>--<viewport>.png` (eingecheckt, R-183). Auf sie verweisen die R-Zeilen als Nachweis.
- **Pflichtzustände** (R-180): eingeklappt (Pille) · läuft · pausiert · Fehler (z. B. unbekannter Bildschirm) · Einstellungen · Log · Statistik · erster Start ohne Daten. Dazu kommen „Nur vorschlagen“ mit hervorgehobener Option im Spiel, Popup und Optionsseite (Chrome).
- Die Bot-Oberfläche wird **über jedem relevanten Spielbildschirm** gezeigt: Hauptmenü, Starterwahl, Karte, „Choose Your Order“, Kampf, Item, Relikt, Tausch, „Team Full“, Orden, Shop, Game Over und Champion. Gezeigt wird das jeweils im dunklen und im hellen Spielmodus (R-218).
- Ein Screenshot ist veraltet, wenn sich der UI-Code danach geändert hat (Vergleich über `git log`).

## 3. Kriterien
Für jedes Kriterium gibt es eine **Prüffrage**. Bei „Nein“ ist es ein Mangel.

1. **Übersicht.** Erkennt man in 2 Sekunden, ob der Bot läuft, was er gerade tut, warum und wie es dem Team geht? Start/Pause, aktuelle Tätigkeit samt Grund, Team-Zustand und Fortschritt stehen vorn und groß (R-150). Es gibt höchstens eine primäre Aktion pro Ansicht.
2. **Hierarchie.** Die Reihenfolge der Gewichtung stimmt: Status → primäre Aktion (Start/Pause/Stopp) → Details. Einstellungen, Log und Statistik liegen dahinter, in Tabs oder ausklappbar (R-151).
3. **Lesbarkeit.** Fließtext ist auf dem iPhone mindestens 16 px groß, kein Text ist kleiner als 12 px. Der Kontrast erfüllt WCAG AA (4,5:1, große Schrift 3:1). Es gibt keine abgeschnittenen oder überlappenden Texte, und Texte haben immer eine eigene, ruhige Fläche. Deutsche Texte sind länger als englische, beide Sprachen werden geprüft (R-174).
4. **Abstände.** Nur Werte aus dem Raster 4/8/12/16/24 px. Zwischen Touch-Zielen liegen mindestens 8 px. Nichts klebt am Rand, und die Safe Areas (Notch, Home-Indicator) werden über `env(safe-area-inset-*)` eingehalten.
5. **Daumen-Bedienung.** Touch-Ziele sind mindestens 44×44 pt groß. Häufige Aktionen liegen im unteren Drittel, die Daumenzone gilt für Rechts- und Linkshänder. Keine Funktion ist nur per Hover oder Tastatur erreichbar (R-176). Stopp ist leicht zu treffen, aber nicht versehentlich auszulösen.
6. **Keine verdeckten Spielbuttons.** In jedem Spielbildschirm bleiben alle wichtigen Spiel-Bedienelemente sichtbar **und** klickbar. Das prüft ein automatischer Test: Die Bounding-Boxen der Bot-UI und der sichtbaren Spielbuttons überschneiden sich nicht, und `elementFromPoint` trifft das Spielelement. Das Overlay lässt sich ziehen, andocken und zur Pille minimieren (R-153 bis R-155, R-002).
7. **Zustände und Feedback.** Läuft, pausiert, Fehler, „Bot unsicher/angehalten“, erster Start und leere Zustände sind klar unterscheidbar, über Statusfarbe **und** Text oder Icon, nie nur über Farbe. Jede Aktion bekommt innerhalb von 100 ms sichtbares Feedback. Fehlermeldungen sind in Alltagssprache formuliert und bieten eine konkrete nächste Handlung (R-172).
8. **Konsistenz.** Gleiche Dinge sehen gleich aus. Die Bot-UI ist klar als eigene Ebene erkennbar und harmoniert trotzdem mit dem dunklen Pixel-Look des Spiels.

## 4. Schweregrade
- **P0:** blockiert die Nutzung, verdeckt oder blockiert einen Spielbutton, Text unlesbar, Bedienung auf dem iPhone unmöglich.
- **P1:** deutlich störend oder fehleranfällig, etwa ein zu kleines Touch-Ziel, eine unklare Hierarchie, ein fehlender Zustand oder ein abgeschnittener Text.
- **P2:** Feinschliff (Abstände, Ausrichtung, Konsistenz).

Eine Phase mit UI-Anteil gilt erst als abgeschlossen, wenn es keinen P0- und keinen P1-Mangel mehr gibt und mindestens zwei Runden mit dem ui-reviewer stattgefunden haben (R-182).

## 5. Design-System (wird in Phase 5 ausgefüllt, R-177)
Vorgaben aus dem Hauptauftrag, mit frontend-design auszuarbeiten:
- **Farben:** Palette passend zum dunklen Spiel-Look mit **einer** Akzentfarbe. Statusfarben für läuft, pausiert und Fehler.
- **Schrift:** höchstens 3–4 Schriftgrößen.
- **Abstände:** 4/8/12/16/24 px.
- **Form:** runde Ecken, dezente Schatten.
- **Icons:** Inline-SVG.
- **Bewegung:** sanfte Übergänge, `prefers-reduced-motion` wird beachtet.
- **Gesamtbild:** klare Hierarchie, viel Luft.
- **Entwürfe:** 2–3 deutlich unterschiedliche HTML-Mockups mit Screenshots (Desktop 1440×900, iPhone 390×844). Die Wahl wird in DECISIONS.md begründet (R-179).
