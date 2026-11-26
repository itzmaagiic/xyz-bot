# P3a – Kämpfe ohne Hänger: Design

Stand 2026-11-26 · Phase 3, erstes Inkrement · Freigabe nach CLAUDE.md (D-006) durch eigenes Review und D-037 · Grundlage: GAME_RECON §12.8 (Live-Aufklärung vom 2026-11-26), PLAN.md Phase 3.

## Absicht
Alle drei Live-Läufe endeten am selben Punkt: Bosskampf auf Karte 3, Pause „action keeps failing: no effect after clicking #btn-auto-battle“. Solange das so bleibt, ist kein vollständiger Run möglich (R-190), und keine Strategie-Messung kommt über 4 Orden hinaus (D-027). P3a beseitigt die Ursache, nicht nur das Symptom. Der Bot unterscheidet künftig zwischen „sichtbar“ und „bedienbar“, erkennt Fortschritt und erkennt echte Hänger an einem Watchdog statt an Klick-Fehlschlägen.

## Befund (GAME_RECON §12.8)
- SKIP ist nach etwa 20 ms aktiv. Nach dem Klick setzt das Spiel `disabled=true` (Deckkraft 0,35, weiter sichtbar), der Kampf läuft weiter: normal 1 bis 7 s, Boss 16,7 s.
- Der Bot hält „SKIP sichtbar, Signatur gleich“ für „keine Wirkung“, klickt den gesperrten Knopf noch zweimal und pausiert nach etwa 15 s.
- Die KP-Texte (`#battle-screen .hp-text`) ändern sich spätestens alle 2 s, sind also ein verlässliches Fortschrittssignal.

## Ziele (R-IDs)
- **R-087:** Vor dem Klick prüft der Bot, ob das Ziel bedienbar ist, nicht nur sichtbar. Ein Knopf, der nach dem Klick gesperrt wird, gilt als Wirkung.
- **R-010:** Ein gesperrter SKIP ist kein unerwarteter Zustand, sondern „Kampf läuft“. Der Bot wartet.
- **R-094 (teilweise):** Die Wirkungsprüfung wartet über einen MutationObserver auf Änderungen statt im 150-ms-Takt zu pollen. Die übrigen festen Wartezeiten und der Check „keine festen Sleeps“ folgen in einem späteren P3-Inkrement.
- **R-095:** Ein globaler Watchdog. Ändert sich X Sekunden lang nichts (Signatur samt Fortschritt), liest er den Zustand neu ein. Hilft das nicht, pausiert der Bot mit Meldung. X ist einstellbar, Standard 60 s.
- **R-190 (Weg dahin):** Ein Live-Lauf kommt ohne Hänger am Bosskampf vorbei. Das Urteil fällt über `liveVerdict`.

## Nicht-Ziele
- Strategie (warum der Bot gegen Erika verliert): P4.
- Run-Logs nach D-005 unter `runs/`: P3b.
- Typisierte Pausen, Stillstands-Budget je Bildschirm (R-254): P3b.
- Touch-Events (R-086): späteres Inkrement.

## Anti-Ziele
- Den Klick-Fehlschlag einfach länger tolerieren, etwa mit mehr Versuchen oder längerem Timeout. Das verschiebt den Hänger nur.
- Gesperrte Knöpfe trotzdem klicken. Menschlich wäre das nicht, und es erzeugt Fehlalarme.
- Ein Watchdog, der in langen, aber fortschreitenden Kämpfen auslöst.

## Ansätze
1. **Nur der Kampf-Sonderfall:** Die Engine prüft bei SKIP `disabled` und wartet sonst. Klein, aber derselbe Fehler träfe jeden anderen Knopf, der nach dem Klick gesperrt wird oder kurz gesperrt ist (Item- und Fang-Bildschirme). Verworfen.
2. **Allgemeines „bedienbar“-Konzept mit Fortschritt und Watchdog (gewählt):**
   - `isActionable` im Detector.
   - `doClick` klickt nur bedienbare Ziele, sonst wird gewartet, ohne Fehlschlag.
   - Die Wirkungsprüfung akzeptiert „Ziel gesperrt oder verschwunden“ und wartet per MutationObserver.
   - Die Kampfsignatur enthält den Zustand von SKIP und den KP-Fortschritt.
   - Ein Watchdog fängt echte Hänger.
3. **SKIP gar nicht klicken, sondern die Auto-Skip-Einstellung des Spiels nutzen:** Der Nutzer muss sie bestätigen (R-074). Ohne Bestätigung laufen Kämpfe langsam, und das Grundproblem „sichtbar statt bedienbar“ bleibt. Verworfen als Lösung, R-074 bleibt als Tempo-Option in P5.

## Design
- **`isActionable(el)`** (`src/core/screens/detector.ts`): `isShown(el)` und nicht `:disabled`, nicht `aria-disabled="true"`, berechnetes `pointer-events` ≠ `none`.
- **Kampfsignatur** (`extraSignature`, `battle`):
  - SKIP-Zustand: `skip` (bedienbar), `skip-off` (sichtbar, gesperrt) oder leer.
  - Dazu `cont`, wenn WEITER bedienbar ist.
  - Dazu ein kurzer Hash der KP-Texte im Kampfbildschirm.
- **Engine** (`battle`):
  - WEITER bedienbar → klicken.
  - SKIP bedienbar → klicken.
  - Sonst `wait` mit Begründung „battle running (skip pressed)“ bzw. „battle running“.
- **Bot:**
  - `doClick`: Ein nicht bedienbares Ziel wird nicht geklickt. Es gibt eine Log-Zeile `debug`, Rückgabe wie bei `wait`, **kein** `failed()`.
  - `waitForChange` (MutationObserver auf `document`: `attributes`, `childList`, `characterData`, `subtree`, mit Timeout `VERIFY_TIMEOUT`) meldet Wirkung, sobald das Ziel abgehängt, unsichtbar oder **nicht mehr bedienbar** ist oder sich die Signatur ändert.
- **Watchdog** (`BotController`):
  - Er merkt sich die Zeit der letzten Signaturänderung.
  - Ohne Änderung für `watchdogSec` (Einstellung, Standard 60, Bereich 15–600): erst `refresh` mit neuem Snapshot und Log `warn`.
  - Bleibt es weitere `watchdogSec / 2` unverändert: Pause `errorPause('stalled', …)`. `stalled` kommt als neuer Fehler-Pausengrund in `pause-reason.ts` hinzu, `isErrorPause` erkennt ihn.
  - Die Zeit ist injizierbar (`now()`), damit es testbar ist.
- **Einstellung `watchdogSec`:** `settings.ts` (normalisiert und begrenzt) plus ein Feld im Einstellungsformular.
- **Tests:**
  - Detector: `isActionable`, Signatur mit `skip-off` und KP.
  - Engine: Kampf mit gesperrtem SKIP ergibt `wait`.
  - Bot: Ein gesperrtes Ziel zählt nicht als Fehlschlag. Ein Knopf, der nach dem Klick gesperrt wird, zählt als Wirkung. Der Watchdog liest erst neu ein und pausiert dann.
  - Eine Regression mit den Zeitreihen aus der Aufklärung: SKIP aktiv, nach dem Klick gesperrt, 16 s lang wechselnde KP, dann WEITER. Ergebnis: keine Pause.
  - Dazu ein Live-Lauf als Nachweis.

## Dem Umsetzer überlassen
Die genaue Hash-Funktion für die KP-Texte, die Formulierung der Log-Texte und die Namen der Testfälle.
