# UI-Qualitätskriterien (Grundlage für den ui-reviewer)

Diese Kriterien gelten für jede Oberfläche des Bots. Der `ui-reviewer` bewertet Screenshots danach, `frontend-design` setzt sie gestalterisch um.
Ein Kriterium gilt als erfüllt, wenn es auf **allen** Viewports und in **allen** Zuständen erfüllt ist.

## 1. Viewports (Playwright)
| Name | Einstellung | Zweck |
|---|---|---|
| `desktop` | `viewport: 1440×900` | Standard-Desktop |
| `iphone` | `devices['iPhone 15 Pro']` (393×852, DPR 3, Touch) | Hauptziel mobil |
| `iphone-se` | `devices['iPhone SE']` (375×667) | kleinstes unterstütztes iPhone |

Hochformat ist Pflicht. Querformat wird nur geprüft, wenn der Hauptauftrag es verlangt.

## 2. Screenshots
- Ablage: `screenshots/<bereich>/<zustand>--<desktop|iphone|iphone-se>.png` (D-004). Sie werden per Skript erzeugt, nie von Hand.
- Pflichtzustände der Bot-Oberfläche, soweit vorhanden: bereit/leer · läuft · pausiert · Fehler/unbekannter Zustand · Einstellungen offen · Log/Details offen · Run-Zusammenfassung.
- Die Bot-Oberfläche wird **über jedem relevanten Spielbildschirm** gezeigt: Hauptmenü, Starterwahl, Map, Kampf-Vorbereitung („Choose Your Order“), Kampf, Item-, Relikt- und Tauschauswahl, „Team Full!“, Orden, Game Over und Sieg.
- Ein Screenshot ist veraltet, wenn sich der UI-Code danach geändert hat (Vergleich über `git log`).

## 3. Kriterien
Für jedes Kriterium gibt es eine **Prüffrage**. Bei „Nein“ ist es ein Mangel.

1. **Übersicht.** Erkennt man in 2 Sekunden, ob der Bot läuft, was er gerade tut und was als Nächstes passiert? Die wichtigste Information ist ohne Scrollen sichtbar. Es gibt höchstens eine primäre Aktion pro Ansicht.
2. **Hierarchie.** Die Reihenfolge der Gewichtung stimmt: Status → primäre Aktion (Start/Pause/Stopp) → Details. Größe, Gewicht und Farbe folgen dieser Reihenfolge, nichts konkurriert visuell gleichrangig.
3. **Lesbarkeit.** Fließtext ist auf dem iPhone mindestens 16 px groß, kein Text ist kleiner als 12 px. Der Kontrast erfüllt WCAG AA (4,5:1, große Schrift 3:1). Es gibt keine abgeschnittenen oder überlappenden Texte und keinen Text direkt auf unruhigem Spielhintergrund ohne eigene Fläche.
4. **Abstände.** Es gilt ein einheitliches 4/8-px-Raster. Zwischen Touch-Zielen liegen mindestens 8 px. Nichts klebt am Bildschirmrand, und die Safe Areas (Notch, Home-Indicator) werden über `env(safe-area-inset-*)` eingehalten.
5. **Daumen-Bedienung.** Touch-Ziele sind mindestens 44×44 pt groß. Häufige Aktionen liegen im unteren Drittel, die Daumenzone gilt für Rechts- und Linkshänder. Keine Funktion ist nur per Hover erreichbar. Kritische Aktionen wie Stopp sind leicht zu treffen, aber nicht versehentlich auszulösen.
6. **Keine verdeckten Spielbuttons.** In jedem Spielbildschirm bleiben alle Spiel-Bedienelemente sichtbar **und** klickbar. Das prüft ein automatischer Test: Die Bounding-Boxen der Bot-UI und der sichtbaren Spielbuttons überschneiden sich nicht, und `elementFromPoint` trifft das Spielelement. Die Bot-UI lässt sich einklappen.
7. **Zustände und Feedback.** Laden, Fehler, Pause, „Bot unsicher/angehalten“ und leere Zustände sind klar unterscheidbar. Jede Nutzeraktion bekommt innerhalb von 100 ms sichtbares Feedback.
8. **Konsistenz.** Gleiche Dinge sehen gleich aus. Die Bot-UI ist klar als eigene Ebene erkennbar und harmoniert trotzdem mit dem Pixel-Look des Spiels (Gestaltung über frontend-design).

## 4. Schweregrade
- **P0:** blockiert die Nutzung, verdeckt oder blockiert einen Spielbutton, Text unlesbar, Bedienung auf dem iPhone unmöglich.
- **P1:** deutlich störend oder fehleranfällig, etwa ein zu kleines Touch-Ziel, eine unklare Hierarchie oder ein fehlender Zustand.
- **P2:** Feinschliff (Abstände, Ausrichtung, Konsistenz).

Eine Phase mit UI-Anteil gilt erst als abgeschlossen, wenn es keinen P0- und keinen P1-Mangel mehr gibt.
