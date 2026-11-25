# Bestandsaufnahme Phase 1: Abschnitte I, K, L, M, O, P und Z (Oberfläche, Lieferung, Sicherheit, Infrastruktur)
requirements-reviewer, Stand `73fee64` (Build und Tests auf einer Kopie mit Stand `dff0c50`), 2026-11-25. Prüfprotokoll: `npx vitest run` 109/109, `npm run build` erzeugt beide Ziele, `unzip -t` fehlerfrei, `playwright test --list` 18 Tests, `check-hook-budget.sh` OK, Hook Exit 0. Datenschutz: kein Fund. Vorschlag: 16 ✅ (15 bestätigt, R-201 neu), 35 🟡, 40 ❌.

| R-ID | Vorschlag | Nachweis bzw. Fundstelle | Lücke |
|---|---|---|---|
| R-149 | 🟡 | `app.ts:43-44` mountet das Overlay für beide Ziele. E2E `extension.spec.ts:23`, `userscript.spec.ts:6` | – |
| R-150 | 🟡 | Start/Pause (`overlay.ts:123`), Bildschirm und Entscheidung (`:152-153`) | Team-Zustand und Fortschritt fehlen, nichts groß (13 px) |
| R-151 | 🟡 | Einstellungen und Log als `<details>` (`overlay.ts:163-169, 220-226`) | Keine Statistik-Ansicht, keine Tabs |
| R-152 | 🟡 | `attachShadow` (`overlay.ts:64`), `:host{all:initial}` | Kein Isolations-Test. Toasts liegen im Spiel-DOM (`toast.ts:6-12`) |
| R-153 | 🟡 | Pointer-Drag am Header (`overlay.ts:241-260`), `touch-action:none` | Kein Test |
| R-154 | 🟡 | Einklappen blendet `.body` aus (`overlay.ts:43, 109-114`) | Keine Pille, Header bis 330 px breit |
| R-155 | ❌ | Nur Begrenzung auf den Viewport (`overlay.ts:249-250`) | Kein Andocken |
| R-156 | 🟡 | `overlayCollapsed` gespeichert | Position nicht gespeichert, kein Test |
| R-002 | ❌ | – | Kein Test. Panel `fixed` links unten, bis 330 px breit und `100vh` hoch |
| R-157 | 🟡 | Start/Pause (`bot.ts:148-172`) | Kein Stopp |
| R-011 | ❌ | Pause greift nur zwischen Ticks (`bot.ts:185-187`) | **Pausiert der Nutzer während `attachSim`, klickt `tick()` danach trotzdem** (`bot.ts:373-407`). Reorder und Backoff laufen weiter |
| R-158 | 🟡 | `step()` (`bot.ts:175-179`), E2E „step performs exactly one verified click“ | Während der Bot läuft, tut `step()` still nichts |
| R-159 | ❌ | – | Kein „Nur vorschlagen“-Modus |
| R-160 | 🟡 | `settings-form.ts`: Modus, Challenge/Stufe/Starter, Variante, Region | `preferredStarter` fehlt im Formular, Tower ohne Stufe und Schwierigkeit |
| R-161 | ❌ | – | Keine Profile |
| R-162 | 🟡 | `actionDelayMs`, ±40 % fest | Bereich und Zufallsanteil nicht einstellbar |
| R-163 | 🟡 | `maxRuns`/`autoRestart` (`bot.ts:402-403`) | Champ-Sieg, Shiny, Niederlage und Zeit fehlen |
| R-164 | ❌ | – | Kein Ton |
| R-165 | ❌ | – | Keine Einstellung für riskante Aktionen, kein Budget |
| R-166 | ❌ | – | Keine Autostart-Option |
| R-167 | 🟡 | Standardwerte (`settings.ts:32-50`), Test der Normalisierung | Keine Erklärtexte |
| R-168 | 🟡 | Bildschirm und Entscheidung | Knoten, Team mit KP/Level und nächster Boss fehlen |
| R-169 | 🟡 | Runs, Siege und Niederlagen gespeichert und angezeigt | Siegquote, Rekord und Laufzeit fehlen |
| R-170 | 🟡 | Log (`overlay.ts:163-169`) | Kein Filter |
| R-171 | ❌ | Nur „Log kopieren“ als Text | Kein JSON-Export oder -Import |
| R-172 | ❌ | Technische, englische Meldungen (`bot.ts:120, 199, 506`, `engine.ts:322`) | Keine Alltagssprache |
| R-173 | 🟡 | „Log kopieren“ | Kein bereinigtes Debug-Paket |
| R-174 | ❌ | UI-Texte fest auf Deutsch, Meldungen auf Englisch | Kein i18n |
| R-175 | 🟡 | Chrome-`commands` | In-Page-Kürzel fest, im Userscript nicht konfigurierbar |
| R-176 | 🟡 | Hauptfunktionen sind Buttons | Overlay ausblenden nur per Taste. Tasten-Hinweis erscheint auch auf iOS |
| R-001 | ❌ | – | Keine Screenshots, Projekte `desktop` und `iphone` fehlen |
| R-003 | ❌ | Buttons 32 px, Selects 30 px | Unter 44 pt |
| R-004 | ❌ | – | UI.md §6 leer |
| R-005 | ❌ | – | Kein `env(safe-area-inset-*)`, `100vh`, kein Projekt `iphone-se` |
| R-177 | ❌ | – | Kein Design-System |
| R-178 | ❌ | – | P5 |
| R-179 | ❌ | – | Keine Mockups |
| R-180 | ❌ | – | Keine Zustands-Screenshots |
| R-181 | ❌ | – | – |
| R-182 | ❌ | – | – |
| R-183 | ❌ | `docs/screenshots/` fehlt | – |
| R-074 | 🟡 | Whitelist (`protocol.ts:33-41`, `page-bridge.ts:161-170`), zweistufig (`overlay.ts:180-218`, `bot.ts:134-146`), E2E `extension.spec.ts:55` | Die Bridge erzwingt die Bestätigung nicht selbst |
| R-201 | ✅ | `package.json:8-16`. Prüfprotokoll: `npm run build` (beide Ziele), `npx vitest run`, `playwright test --list` | – |
| R-202 | 🟡 | `build.mjs:132-177`, Zip mit `unzip -t` fehlerfrei | Laden nur im E2E |
| R-203 | ❌ | `dist/` gitignored | Nicht eingecheckt, keine Update-URLs |
| R-204 | 🟡 | Eine Versionsquelle (`build.mjs:156, 193`) | Kein Check |
| R-205 | 🟡 | README auf Deutsch: Installation, Bedienung, Grenzen | Updates, Einstellungen und Fehlerbehebung fehlen. Grenzen veraltet |
| R-206 | 🟡 | GAME_RECON, STRATEGY, UI.md | `docs/screenshots/` und CHANGELOG fehlen |
| R-207 | 🟡 | STRATEGY.md:6-95 | Profile, Gewichte und Zielwert fehlen |
| R-208 | ❌ | – | Kein CHANGELOG |
| R-209 | ✅ bestätigt | `git grep` über alle 3 Remote-Refs: 0 | Rest siehe R-244 |
| R-210 | ❌ | – | Kein `check:secrets` |
| R-211 | ✅ bestätigt | Fixture mit `_note` plus 4 Schlüsseln, Regex 0 Treffer, `check-ignore` | – |
| R-212 | 🟡 | Erkennung über IDs, DE/EN nur bei starter und catch | 20 von 29 Fixtures in nur einer Sprache |
| R-213 | ❌ | – | Eingriffe des Nutzers werden nicht erkannt |
| R-214 | ❌ | `resumeRuns` standardmäßig `true` (`settings.ts:41`), `engine.ts:91-101` setzt ohne Rückfrage fort | **Widerspricht der Anforderung** |
| R-215 | ❌ | `engine.ts:320-322` pausiert nur | Kein Snapshot |
| R-216 | ❌ | Neuaufbau des Overlays alle 1,5 s (`bot.ts:89-91`, `overlay.ts:99`) | Keine Messung |
| R-217 | 🟡 | Native Buttons, `focus-visible`, `aria-label`, `role=log` | Kein Test |
| R-218 | 🟡 | `prefers-color-scheme` | Ignoriert `darkMode` des Spiels |
| R-219 | ❌ | Das Fixture wird von keinem Test geladen | – |
| R-220 | 🟡 | iPhone 13 mit 390×664, `userscript.spec.ts:60` prüft nur horizontal | Keine vertikale Prüfung, keine Prüfung auf Verdeckung |
| R-221 | ❌ | Nur `bosses.ts`, `typechart.ts` | Keine Daten zu Items, Relikten und Traits |
| R-222 | 🟡 | Detector „map-move-tutor“, engine.test „teaches the best attacker“ | Skip-Pfad ungetestet |
| R-223 | 🟡 | `chooseBagUse`, Tests in items und engine | Heilung vor dem Boss ungetestet |
| R-225 | ✅ bestätigt | `git ls-remote` | – |
| R-226 | ❌ | – | `skipResetConfirm` wird nicht gelesen |
| R-227 | 🟡 | `engine.ts:112-113, 151-152`, Tests | Gesperrte Tower-Stufen, Modi und Challenges fehlen |
| R-228 | 🟡 | Wegwerf-Profil, Cloud-Routen blockiert, Token-Filter (`live.spec.ts`) | Kein Hinweis beim ersten Start |
| R-229 | ❌ | Nur `window.__pkbotApp` | Gilt pro JS-Welt, keine Tab-Sperre |
| R-230 | ❌ | – | Kein Zielwert |
| R-231 | 🟡 | Shift+Ziffer (`bot.ts:443-465, 520-540`), guard.test | Kein Test, dass der Tausch wirkt |
| R-232 | ✅ bestätigt | Skript ausgeführt: P0–P7 im Budget, 0 fehlende IDs | – |
| R-243 | ✅ bestätigt | PROGRESS.md | – |
| R-244 | 🟡 bestätigt | Der alte Branch enthält noch den Commit mit der privaten Adresse, main ist sauber | Löschen durch den Nutzer |
| R-245 | ❌ | – | – |
| R-246 | ❌ | – | Manuell geprüft: IDs lückenlos, Tags passen |
| R-247 | ❌ | – | – |
| R-248 | ✅ bestätigt | `sim-seed.test.ts` 4/4 | – |
| R-015 | 🟡 | WebKit vorhanden, Tests grün | Frische Session unbestätigt |
| R-016 | 🟡 | Setup-Skript der Umgebung (D-026) | Nicht im Repo versioniert. PLAN.md und D-002/D-011 nennen noch den Hook |
| R-017 bis R-026 | ✅ bestätigt (R-020 🟡) | siehe Zeilen in REQUIREMENTS | CLAUDE.md „Befehle“ war zeitweise veraltet |

**Auffälligkeiten**
1. **Pause wirkt nicht sofort** (R-011): sicherheitsrelevant, in P3 vorziehen.
2. **Fremde Runs werden ohne Rückfrage übernommen** (R-214, `resumeRuns=true`).
3. **Kein Schutz vor doppeltem Start über JS-Welten hinweg** (R-108, R-229).
4. **Overlay wird ständig neu aufgebaut** (R-216, R-176, R-003): Auf dem iPhone drohen verlorene Taps.
5. Doku-Widersprüche zu D-026 (PLAN, D-002, D-011), CLAUDE.md „Befehle“ und README „Grenzen“.
