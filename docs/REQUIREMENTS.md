# Anforderungen

Einzige Quelle der Wahrheit für **was** gebaut wird. Neue oder geänderte Anforderungen des Nutzers werden hier
eingetragen, bevor sie umgesetzt werden. Den Stand der Umsetzung hält `docs/PROGRESS.md` fest.

## R1 Ziel

Ein Bot, der https://pokelike.xyz selbstständig, effizient und klug spielt.

## R2 Ziele und Plattformen (eine Codebasis)

- R2.1 **Chrome MV3** (auch Edge, Opera, andere Chromium-Browser): entpackt und als Zip, mit Popup, Optionsseite,
  Tastenkürzeln (`commands`) und Benachrichtigungen. Was der Browser nicht kann, wird per Feature-Erkennung erkannt;
  dann greifen In-Page-Toasts.
- R2.2 **Userscript** (`.user.js` + `.meta.js`) für die iOS-App „Userscripts“, Tampermonkey und Violentmonkey: GM.*-Adapter,
  Bridge über ein Script-Element plus CustomEvent mit DOM-Fallback, In-Page-Toasts, eigene Tastenkürzel.
- R2.3 Gemeinsamer Code liegt in `src/core` und `src/ui`, plattformspezifischer nur in `src/platform/chrome` und
  `src/platform/userscript`. Safari/Xcode wird nicht unterstützt.
- R2.4 npm-Skripte: `build`, `build:chrome`, `build:userscript`, `test`, `e2e` (Chrome mit Erweiterung; Userscript mit
  GM-Shim in Chromium und WebKit/iPhone).

## R3 Architektur und Qualität

- R3.1 TypeScript strict, esbuild, ESLint + Prettier, Vitest, Playwright.
- R3.2 `core/screens`: Bildschirmerkennung. Bei einem **unbekannten Bildschirm pausiert der Bot** und rät nie.
- R3.3 `core/strategy`: reine, unit-getestete Funktionen. Jede Entscheidung trägt eine Begründung.
- R3.4 `core/actions`: menschenähnliche Aktionen, Erfolg prüfen, Backoff.
- R3.5 `core/data`: Daten bevorzugt aus dem Spiel selbst. Die Spielversion wird erkannt; bei einer neuen Version wird gewarnt.
- R3.6 Recon jedes Bildschirms in `docs/GAME_RECON.md`, DOM-Fixtures in `tests/fixtures/`.

## R4 Spielmodi

- R4.1 Story (Classic/Nuzlocke, Region, Charakter, Starter): Ziel ist, den Champ sicher zu besiegen.
- R4.2 **Challenges (Schwerpunkt):** Arena-, Tages- und Wochen-Challenge mit Orden-Stufe. Traits, Augments und Relikte
  sind dort aktiv und müssen berücksichtigt werden. Kombos und Traits gezielt nutzen.
- R4.3 Den Challenge-Starter (aus dem PC) kann man vorher auswählen.
- R4.4 Relikte und Items werden anhand der Spieldaten bewertet (Item-Handbuch / `PASSIVE_ITEM_POOL`).
- R4.5 Battle Tower experimentell.

## R5 Sicherheit und Fairness (nicht verhandelbar)

- R5.1 **Pokédollar** (Shop, Eier, Vitamine) gibt der Bot nie ohne ausdrückliche Bestätigung des Nutzers aus.
- R5.2 Der Bot schreibt nie in den localStorage des Spiels und patcht keine Spielfunktionen. Ausnahmen: die dokumentierten
  UI-Öffner (`openUsableItemModal`, `openItemEquipModal`) und `saveSettings` mit Whitelist, nur nach zweistufiger Bestätigung.
- R5.3 Simulationen laufen nur mit eigenen Seeds. Echte Zufallsergebnisse werden nie vorhergesagt.
- R5.4 Private Spielstände und Tokens werden nie committet (`tests/fixtures/private/`, `*.save.json`).

## R6 Dokumentation

- R6.1 Das README beschreibt die Installation für beide Ziele (auch Opera) und die Bedienung.
