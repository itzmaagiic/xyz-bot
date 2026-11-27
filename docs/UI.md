# UI: Qualitätskriterien und Design-System

Diese Datei ist der Maßstab für den `ui-reviewer` und für `frontend-design`. Sie gilt für alle sichtbaren Teile: das Overlay auf der Spielseite (`src/ui/overlay.ts`, Shadow DOM) samt Pille, das gemeinsame Einstellungsformular (`src/ui/settings-form.ts`), die Toasts (`src/ui/toast.ts`) sowie Popup und Optionsseite unter `src/platform/chrome`.
Ein Kriterium gilt als erfüllt, wenn es auf **allen** Viewports und in **allen** Zuständen erfüllt ist.

## 1. Viewports (Playwright)
| Name | Einstellung | Zweck |
|---|---|---|
| `desktop` | Chromium, `viewport: 1440×900` | Desktop, vom Hauptauftrag vorgegeben |
| `iphone` | WebKit, `{...devices['iPhone 13'], viewport: {width: 390, height: 844}}` (DPR 3, Touch) | Hauptziel mobil, Maße vom Hauptauftrag vorgegeben |
| `iphone-safari` | WebKit, `devices['iPhone 13']` unverändert (Viewport 390×664) | realistisch sichtbare Fläche mit Safari-Leisten. Hier zeigt sich, ob etwas verdeckt oder abgeschnitten wird (R-220, eigene Idee) |
| `iphone-se` | WebKit, `devices['iPhone SE (3rd gen)']` (375×667, DPR 2) | kleinstes unterstütztes iPhone (R-005, eigene Idee). Achtung: `devices['iPhone SE']` ist das alte Modell mit 320×568 |

Hochformat ist Pflicht. Querformat auf dem iPhone wird mindestens einmal geprüft (Overlay bleibt bedienbar), ist aber kein Schwerpunkt.
Falls WebKit noch nicht läuft (D-011), ist Chromium-Emulation nur als **gemeldeter Übergang** erlaubt. Der Screenshot trägt das dann im Dateinamen (`--chromium-emu`), PROGRESS.md führt es unter „Bekannte Probleme“, und ein so belegter Punkt bleibt 🟡.

## 2. Screenshots
- **Arbeits-Screenshots:** `artifacts/screenshots/<bereich>/<zustand>--<viewport>.png` (gitignored). Sie werden per Skript erzeugt, nie von Hand.
- **Finale und Nachweis-Screenshots:** `docs/screenshots/<bereich>/<zustand>--<viewport>.png` (eingecheckt, R-183). Auf sie verweisen die R-Zeilen als Nachweis.
- **Pflichtzustände** (R-180): eingeklappt (Pille) · läuft · pausiert · Fehler (z. B. unbekannter Bildschirm) · Einstellungen · Log · Statistik · erster Start ohne Daten. Dazu kommen „Nur vorschlagen“ mit hervorgehobener Option im Spiel, Popup und Optionsseite (Chrome).
- Die Bot-Oberfläche wird **über jedem relevanten Spielbildschirm** gezeigt: Hauptmenü, Starterwahl, Karte, „Choose Your Order“, Kampf, Item, Relikt, Tausch, „Team Full“, Orden, Shop, Game Over und Champion. Gezeigt wird das jeweils im dunklen und im hellen Spielmodus (R-218).
- Ein Screenshot ist veraltet, wenn sich der UI-Code danach geändert hat (Vergleich über `git log`).

## 3. Bestand (aus dem Vorgänger-Branch, D-016)
- Das Overlay lässt sich zusammenklappen und verschieben. Es zeigt Start/Pause, Schritt, „Log kopieren“, den Status (Bildschirm, Entscheidung mit Begründung, Datenquelle, Version, Runs), die Einstellungen und das Log.
- Overlay und Chrome-Optionsseite bauen dasselbe Formular. Neue Einstellungen werden dort genau einmal ergänzt.
- Die Oberfläche ist auf Deutsch, kurz und ohne Fachjargon.
- Was dem Hauptauftrag noch fehlt, steht in `docs/REQUIREMENTS.md` Abschnitt I: z. B. Pille, Andocken, Stopp, „Nur vorschlagen“, Englisch, Statistik, Export/Import und Design-System. Das ist Phase 5.

## 3a. Kriterien
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

## 5. Design-Prozess (mit dem Plugin `frontend-design`)
1. **Ziel klären:** Welche Entscheidung oder Information braucht der Nutzer auf diesem Bildschirm? Als Anforderung in `docs/REQUIREMENTS.md` festhalten.
2. **Rahmen beachten:** Das Overlay liegt über dem Spiel. Es darf Spielbedienelemente nicht verdecken (Abschnitt 3a, Kriterium 6) und muss auf dem iPhone (Userscript, WebKit) bedienbar bleiben. Es läuft im Shadow DOM.
3. **Entwerfen** mit `frontend-design`: 2–3 deutlich unterschiedliche HTML-Mockups (R-179), klare Hierarchie (Status vor Einstellungen), heller und dunkler Modus, ausreichende Kontraste, Zustände farb- **und** textcodiert.
4. **Prüfen:** Screenshots aller Zustände auf allen Viewports aus Abschnitt 1. Dazu der `ui-reviewer`, mindestens zwei Runden (R-182). `npm run e2e` muss grün sein.
5. **Festhalten:** Wahl und Begründung kommen in DECISIONS.md, der Befund in PROGRESS.md, die finalen Screenshots nach `docs/screenshots/`.

## 6. Design-System (wird in Phase 5 ausgefüllt, R-177)

**Stand 2026-11-27 (D-041, Challenge-Overlay):**
- **Farben:** `--bg #141a33`, `--surface #1c2347`, `--line #2f3a6b`, `--fg #eef1fb`, `--muted #a8b1d6`.
  - Akzent: `--gold #f4c542` mit Text `#231a00`.
  - Status: `--run #4ade80`, `--pause #ffa94d`, `--bad #ff8a8a`.
  - Durchgehend `color-scheme: dark`.
- **Schrift:** System-UI in 12 / 14 / 18 px, auf dem iPhone ist der Fließtext 16 px.
- **Form:** Panel mit 12 px Radius, Bedienelemente mit 8 px. Etappen-Felder sind fast eckig (2 px), passend zum Pixel-Look.
- **Symbole:** Inline-SVG.
- **Bewegung:** keine.

Vorgaben aus dem Hauptauftrag, mit frontend-design auszuarbeiten:
- **Farben:** Palette passend zum dunklen Spiel-Look mit **einer** Akzentfarbe. Statusfarben für läuft, pausiert und Fehler.
- **Schrift:** höchstens 3–4 Schriftgrößen.
- **Abstände:** 4/8/12/16/24 px.
- **Form:** runde Ecken, dezente Schatten.
- **Icons:** Inline-SVG.
- **Bewegung:** sanfte Übergänge, `prefers-reduced-motion` wird beachtet.
- **Gesamtbild:** klare Hierarchie, viel Luft.
- **Entwürfe:** 2–3 deutlich unterschiedliche HTML-Mockups mit Screenshots (Desktop 1440×900, iPhone 390×844). Die Wahl wird in DECISIONS.md begründet (R-179).
