# Pokelike – Aufklärung (Game Recon)

Stand: **2026-11-24**, beobachtete Spielversion **v3.8** (`PATCH_NOTES[0].version`, Patch-Datum 2026-11-20),
Bundle `js/bundle.d97633119f.js`. Alles hier wurde live mit Playwright (Chromium) gegen https://pokelike.xyz
beobachtet, einmal mit frischem Profil (nur Kanto offen) und einmal mit einer **bereinigten Kopie** eines echten
Spielstands (alle Regionen offen, Sprache Deutsch). Wiki-Seiten waren nur Hinweise; maßgeblich ist das hier.

## 1. Technik

| Frage | Ergebnis |
|---|---|
| DOM oder Canvas? | **DOM.** Jeder Bildschirm ist ein `<div class="screen">` mit fester ID; der aktive trägt `.active`. Karte = SVG im DOM. Nur Kampf-Effekte (`BattleFX`) nutzen Canvas – irrelevant. |
| Framework | **Keins** (Vanilla-JS, ein klassisches Script, kein Modul). Der Code ist mit einem String-Array-Obfuscator verschleiert (`OcH(0x1234)`), aber **alle Top-Level-Funktionen sind als globale Funktionen sichtbar** (~2100, z. B. `showScreen`, `onNodeClick`, `doCatchNode`, `getTypeEffectiveness`, `getBestMove`, `calcDamage`, `getSettings`, `saveSettings`). |
| Globaler Spielzustand | Lexikalische Top-Level-Variable **`state`** (kein `window.state`, aber per `eval('state')` / direkter Referenz im Hauptkontext lesbar). Daneben `window._currentScreenId`, `TYPE_CHART`, `__POKEDEX__` (792 Spezies mit Typen/Basiswerten), `PATCH_NOTES`, `endlessState`. |
| Speicherstände | **localStorage**, Schlüssel `poke_*` (z. B. `poke_current_run`, `poke_settings`, `poke_pokedollars`, `poke_dex`, `poke_hall_of_fame`, `poke_parked_run:endless2`, `poke_stat_buffs`) und `pkrl_*` (Spezies-Cache). Kein IndexedDB. Cloud-Sync optional über `poke_save_token`. |
| Isolierte Welten | Content-Scripts (isolierte Welt) sehen `state` **nicht** ⇒ eine Bridge im Hauptkontext ist nötig (Chrome: `world: "MAIN"`; Userscript: `<script>`-Element). |
| CSP | `object-src 'none'; base-uri 'self'; frame-ancestors 'self'` – **kein `script-src`**, Inline-Script-Injektion funktioniert. |
| Anti-Tamper | Objekt `pk` mit `storageDigest()`; beim Import einer bereinigten Kopie in ein neues Profil blieb `pk.active === false`, nichts wurde verworfen. Erlaubte Hosts stehen in `__pkl_allowed`. Der Bot **schreibt nie** in localStorage und patcht keine Spielfunktionen. |
| Speichern mitten im Kampf | **Nein.** Reload während eines Kampfes ⇒ der Run war nicht fortsetzbar (Resume-Button weg). Bot darf während `battle-screen` nie neu laden. |
| Sprache | UI ist übersetzt (en, es, de, pt, it, fr, zh, ja). **Texte sind für Erkennung unbrauchbar** – nur IDs, Klassen, `data-*`, Sprite-Pfade und `state` verwenden. Spezies-/Itemnamen sind in `state` immer Englisch. |
| Tastenkürzel | Viele Buttons tragen `data-shortcut` (`1`…`6`, `Space`); Anzeige über Setting `showShortcuts`. |

## 2. Version

- Quelle: `PATCH_NOTES[0].version` (`"3.8"`), Fallback `.title-version` (Text `v3.8`).
- Der Bot speichert die zuletzt gesehene Version und zeigt bei Abweichung eine Warnung (Modus „vorsichtig“: pausiert bei jedem Fehlschlag sofort).

## 3. Einstellungen (`getSettings()`)

`autoSkipBattles`, `autoSkipAllBattles`, `autoSkipEvolve`, `skipResetConfirm`, `misclickProtection`, `darkMode`,
`hideBossPreview`, `showShortcuts`, `cardColours`, `cardBold`, `language`, `musicEnabled`, `musicVolume`,
`sfxEnabled`, `sfxVolume`, (im echten Stand zusätzlich `skipTraitFx`).
Die Checkboxen im Settings-Modal haben **keine IDs** ⇒ der Bot ändert Einstellungen über `saveSettings({...getSettings(), …})`
im Hauptkontext – **nur nach Bestätigung** im Overlay. Empfohlen für Tempo: `autoSkipBattles`, `autoSkipAllBattles`, `autoSkipEvolve`.

## 4. Bildschirme (statisch in `index.html`)

| Screen-ID | Bedeutung | Erkennung / Aktionen |
|---|---|---|
| `title-screen` | Titel | `#btn-history-run` (Story), `#btn-continue-run` (Resume Story), `#btn-endless-run` (Tower), `#btn-continue-endless`, `#btn-challenges-run`, `#btn-continue-challenge`, `#btn-pokechain` (Daily Pokésort), `#btn-multiplayer` (disabled) |
| `history-region-select` | Story: Modus + Region | `#btn-history-classic`, `#btn-history-nuzlocke` (Klasse `--selected`), `.history-region-btn` (gesperrt: `.history-region-btn--locked`), Reihenfolge Kanto, Johto, Hoenn, Sinnoh, Unova, Kalos |
| `endless-stage-select` | Battle Tower | `#btn-tower-normal`, `#btn-tower-hardcore`, `.history-region-btn` (Kanto … Kalos, ORAS) |
| `trainer-screen` | Charakter | `#trainer-boy`, `#trainer-girl` |
| `starter-screen` | Starter | Karten in `#starter-choices` |
| `map-screen` | Karte | SVG `g.map-node[data-node-id]`, klickbar: `.map-node--clickable`; Team-Slots `.team-slot.team-slot-reorder` (Klick-Klick tauscht Positionen) |
| `battle-screen` | Kampf (Wild/Trainer/Arena/Elite) | `#btn-auto-battle` (Skip), danach `#btn-continue-battle` (manchmal geht es ohne Button weiter) |
| `catch-screen` | „Wild Pokémon Appeared“ | Karten `#catch-choices .poke-card` (Reihenfolge = `state.savedCatch.instances`), `#btn-skip-catch` |
| `item-screen` | „Item Found“ | `#item-choices .item-card` (Item-ID = Dateiname von `img.item-sprite-icon`), `#btn-skip-item` |
| `passive-screen` | Relic/Passive | `#btn-skip-passive`; Wahl-Karten (Inhalt noch nicht live gesehen) |
| `swap-screen` | „Team Full“ | `#swap-incoming .poke-card` (neues), `#swap-choices .poke-card` (Freilassen), `#btn-cancel-swap` (behalten) |
| `trade-screen` | „Trade Offer“ | `#trade-team-list li.trade-member-row`, `#btn-skip-trade`, `#btn-trade-continue` |
| `shiny-screen` | Shiny-Event | `#btn-take-shiny`, `#btn-skip-shiny` |
| `badge-screen` | „Badge Earned“ | `#btn-next-map` |
| `elite-prep-screen` | Boss-/Elite-Vorbereitung, „Choose Your Order“ | `#elite-prep-player-side .battle-pokemon[data-idx]` (Pointer-Drag tauscht), `#btn-elite-prep-continue` (FIGHT!) |
| `transition-screen` | Übergang | warten |
| `gameover-screen` | Game Over | `#btn-retry` (Play Again), `#btn-gameover-menu` |
| `win-screen` | Champion | `#btn-play-again`, `#btn-win-home`, Share, Climb the Tower, Hall of Fame |
| `stat-buff-screen` | Tower-Buff | `#btn-skip-statbuff` |
| `endless-stage-complete` | Tower-Stufe geschafft | `#btn-stage-continue`, `#btn-stage-again`, `#btn-stage-home` |

## 5. Dynamische Modals / Overlays

Aus der entschlüsselten String-Tabelle (83 Kandidaten). Wichtig für den Bot (blockieren Klicks auf den Screen darunter!):
`item-equip-modal` (Move Tutor/Item anlegen; Buttons `[data-tutor]`, `#btn-skip-tutor`), `usable-item-modal`,
`item-discard-modal`, `evo-overlay`, `eevee-choice-overlay`, `egg-overlay`, `stat-buff-overlay`, `swap-trait-overlay`,
`submap-pick-modal`/`-overlay`, `tutorial-overlay` (Klick irgendwo schließt), `achx-banner` (nicht blockierend),
`misclick-confirm-modal`, `reset-run-modal`, `run-takeover-modal`, `run-moved-overlay`, `shop-modal`,
`league-modal`, `fusion-modal`, `vitamin-apply-modal`, `legend-voucher-modal`, `pokechain-modal`, `settings-modal`.
Erkennung: Element am Bildschirmmittelpunkt, das nicht zum aktiven Screen gehört und `position: fixed` hat.

## 6. Daten aus `state`

- `state.team[]`: `{_uid, speciesId, name, nickname, level, currentHp, maxHp, isShiny, types[], baseStats{hp,atk,def,speed,special,spdef}, heldItem, megaStone, moveTier}` – Reihenfolge = Kampfreihenfolge.
- `state.items[]`, `state.badges`, `state.maxTeamSize` (**Achtung:** größte bisher erreichte Teamgröße, beginnt bei 1 – nicht die Grenze; die Grenze ist 6, danach kommt `swap-screen`), `state.currentMap`, `state.eliteIndex`, `state.nuzlockeMode`, `state.gen2Mode…gen6Mode`, `state.isEndlessMode`.
- `state.map = {nodes{id→{id,type,layer,col,visited,accessible,revealed,trainerSprite?}}, edges[{from,to}], layers[][], mapIndex}`, `state.currentNode`.
- Knotentypen beobachtet: `start, catch, battle, trainer, question, item, trade, pokecenter, move_tutor, boss` (+ weitere laut Code: legendary, shiny, poke_mart …).
- `state.savedCatch = {nodeId, instances[], rerollPool, level}` – die angebotenen Fänge.
- Angriff: `getBestMove(types, baseStats, moveTier)` → `{name, power, type, isSpecial}`.
- Typen: `TYPE_CHART[atk][def]` (18 Typen inkl. Fee), `getTypeEffectiveness(atkType, defTypes[])`.

## 7. Offene Fragen

- Relic-/Passive-Screen, Shop/Pokémart, Entwicklungs-Overlays, Top 4/Champ und Tower-Stat-Buff noch nicht live gesehen → Bot pausiert dort bis zur Implementierung („niemals raten“).
- Pokésort: Lösungslogik nicht umgesetzt (Modal `pokechain-modal`).
- Ob `runBattle` gefahrlos zur Simulation genutzt werden kann (Nebenwirkungen auf `state`/RNG) – bewusst nicht verwendet.
