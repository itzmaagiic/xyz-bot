# Userscript-API: Abgleich Userscripts (iOS), Tampermonkey, Violentmonkey (R-098, R-099)

Stand 2026-11-25 (Phase 2). Diese Datei ist die Grundlage für `ALLOWED_GM` und `NO_GRANT_NEEDED` in `scripts/userscript-meta.mjs`. Der Build bricht ab, wenn das Bundle davon abweicht (R-192, R-193).

## Quellen
| Manager | Quelle | Stand |
|---|---|---|
| **Userscripts** (quoid, iOS/macOS Safari) | README, Abschnitte „API“ und „Metadata“: `https://raw.githubusercontent.com/quoid/userscripts/main/README.md` | Abgerufen am 2026-11-25. Laut README gilt die API für den aktuellen Entwicklungszweig, Copyright 2018–2025 |
| **Tampermonkey** | Typdefinitionen `@types/tampermonkey` 5.5.0 (npm, geändert 2026-10-04), `declare var GM` ab Zeile 1250 | Abgerufen am 2026-11-25. `www.tampermonkey.net` war aus der Cloud-Umgebung nicht erreichbar (DNS) |
| **Violentmonkey** | Typdefinitionen `@violentmonkey/types` 0.3.5 (npm), `VMScriptGMObject` | Abgerufen am 2026-11-25. `violentmonkey.github.io` war aus der Cloud-Umgebung nicht erreichbar (DNS) |

## GM-Funktionen
„✓“ heißt: als `GM.<name>` (Promise-Stil) vorhanden. „—“ heißt: nicht vorhanden.

| Funktion | Userscripts | Tampermonkey | Violentmonkey | `@grant` nötig | Bot nutzt sie |
|---|---|---|---|---|---|
| `GM.getValue(key, default?)` | ✓ | ✓ | ✓ | ja | **ja** (Speicher) |
| `GM.setValue(key, value)` | ✓ (Wert JSON-serialisierbar) | ✓ | ✓ | ja | **ja** (Speicher, als JSON-String) |
| `GM.deleteValue(key)` | ✓ | ✓ | ✓ | ja | nein |
| `GM.listValues()` | ✓ | ✓ | ✓ | ja | nein |
| `GM.addStyle(css)` | ✓ (Promise) | ✓ (Promise) | ✓ (synchron, gibt das Element zurück) | ja | nein (Overlay-CSS steckt im Shadow DOM) |
| `GM.setClipboard(data, type?)` | ✓ (Promise mit Boolean) | ✓ (Promise ohne Wert) | ✓ (synchron) | ja | **ja** (Log kopieren). Erfolg gilt, solange das Ergebnis nicht `false` ist |
| `GM.info` | ✓ | ✓ | ✓ | **nein** (quoid: „available without needing to add it to `@grant`“) | nein |
| `GM.addValueChangeListener` | **—** | ✓ | ✓ | – | **nein**. Fehlt in quoid, deshalb hat das Userscript kein `onChange` (D-031) |
| `GM_getValue`/`GM_setValue` (synchron) | **—** | ✓ | ✓ | – | **nein**. In P2 entfernt, weil quoid sie nicht kennt |
| `GM.xmlHttpRequest`, `GM.openInTab`, `GM.getTab` … | teils | ✓ | ✓ | – | **nein**. Außerhalb der Schnittmenge, und der Bot braucht kein Netzwerk (R-145) |

**Ergebnis:** Die Schnittmenge ist genau `GM.getValue`, `GM.setValue`, `GM.deleteValue`, `GM.listValues`, `GM.addStyle`, `GM.setClipboard` und `GM.info` (R-099). Der Bot nutzt davon drei: Prüfprotokoll vom 2026-11-25 mit `usedGmApis` auf `dist/pokelike-bot.user.js` ergab `{"gm":["getValue","setClipboard","setValue"],"legacy":[],"aliased":0}`. Daraus erzeugt der Build `@grant GM.getValue`, `@grant GM.setClipboard` und `@grant GM.setValue`.

**Regeln für den Code** (vom Bundle-Check erzwungen):
- GM-Funktionen immer wörtlich als `GM.<name>` aufrufen, nie über einen Alias wie `const g = GM`. Nur so lässt sich `@grant` aus dem Bundle ableiten.
- Vor jedem Aufruf prüft eine Feature-Erkennung (`typeof GM !== 'undefined' && typeof GM.x === 'function'`), ob die Funktion da ist (R-100). Fehlt sie oder wirft sie, greift der Fallback (localStorage mit Präfix `pkbot.`, dann RAM, bzw. `copyViaDom`).

## Metadaten-Schlüssel
| Schlüssel | Wert im Bot | Userscripts (quoid) | Anmerkung |
|---|---|---|---|
| `@name`, `@description` | Pokelike Bot, Text aus `package.json` | ✓ | `@name` ist bei quoid zugleich der Dateiname |
| `@namespace` | `https://github.com/itzmaagiic/xyz-bot` | nicht dokumentiert, erscheint in `GM.info.script` | TM/VM nutzen ihn zur Identifikation |
| `@version` | aus `package.json`, SemVer | ✓ | quoid: „does nothing by itself, it needs to be paired with `@updateURL`“ |
| `@match` | `https://pokelike.xyz/*`, `https://www.pokelike.xyz/*` | ✓ (nur http/s) | Mindestens ein `@match` ist Pflicht |
| `@run-at` | `document-idle` | ✓ (`document-start`, `document-end` als Standard, `document-idle`) | |
| `@inject-into` | `content` | ✓ (`auto` als Standard, `content`, `page`) | quoid: „`GM` apis are only available when using `content`“ |
| `@noframes` | gesetzt | ✓ | |
| `@grant` | aus der Nutzung erzeugt, sonst `none` | ✓, ein Wert pro Zeile | |
| `@updateURL` | `…/main/dist/pokelike-bot.meta.js` (GitHub raw) | ✓, muss auf `.meta.js` enden | Funktioniert erst, wenn `dist/` eingecheckt ist (R-203, P7). quoid: „does not correctly implement the entire update process“ (Issue #248) |
| `@downloadURL` | `…/main/dist/pokelike-bot.user.js` (GitHub raw) | ✓, muss auf `.user.js` enden | wie oben |
| `@require` | **nicht verwendet** | ✓ | Alles ist gebündelt (R-107) |

## Offene Punkte
- Live-Test auf einem echten iPhone mit Userscripts (R-108, R-109, P3/P6). Die Playwright-Tests mit WebKit emulieren die GM-API nur über einen Shim (`tests/e2e/userscript-host.ts`).
- Ob `GM.info` in Tampermonkey und Violentmonkey ohne `@grant` verfügbar ist, belegen die Typdefinitionen nicht. Der Bot nutzt `GM.info` derzeit nicht. Sollte er es künftig nutzen, ist das in den offiziellen Docs zu prüfen (sie sind aus der Cloud-Umgebung nicht erreichbar).
