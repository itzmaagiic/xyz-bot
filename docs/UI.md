# Oberfläche

Gilt für alle sichtbaren Teile: das Overlay auf der Spielseite (`src/ui/overlay.ts`, Shadow DOM), das gemeinsame
Einstellungsformular (`src/ui/settings-form.ts`), Toasts (`src/ui/toast.ts`) sowie Popup und Optionsseite unter
`src/platform/chrome`.

## Bestand

- Das Overlay ist zusammenklappbar und verschiebbar. Es zeigt Start/Pause, Schritt, „Log kopieren“, Status (Bildschirm,
  Entscheidung mit Begründung, Datenquelle, Version, Runs), Einstellungen und Log.
- Overlay und Chrome-Optionsseite bauen dasselbe Formular. Neue Einstellungen werden dort genau einmal ergänzt.
- Die Oberfläche ist auf Deutsch, kurz und ohne Fachjargon.

## Design-Prozess (zusammen mit dem Plugin `frontend-design`)

1. **Ziel klären:** Welche Entscheidung oder Information braucht der Nutzer auf diesem Bildschirm? Als Anforderung in
   `docs/REQUIREMENTS.md` festhalten.
2. **Rahmen beachten:** Das Overlay liegt über dem Spiel. Es darf Spielbedienelemente nicht verdecken und muss auf dem
   iPhone (Userscript, WebKit) bedienbar bleiben: Touch-Ziele mindestens 44 px, keine reinen Hover-Funktionen. Es läuft
   im Shadow DOM, damit Spiel-CSS nicht hineinwirkt.
3. **Entwerfen** mit `frontend-design`: klare Hierarchie (Status vor Einstellungen), heller und dunkler Modus,
   ausreichende Kontraste, Zustände (läuft, pausiert, Fehler) eindeutig farb- **und** textcodiert.
4. **Prüfen:** Screenshots mit Playwright in Chromium (Desktop) und WebKit (iPhone) machen und ansehen; die E2E-Tests
   (`npm run e2e`) müssen grün sein.
5. **Festhalten:** Ergebnis und Screenshots-Befund in `docs/PROGRESS.md` eintragen.
