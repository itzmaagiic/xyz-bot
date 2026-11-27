# Pokelike – Aufklärung (Game Recon)

Stand: **2026-11-24** (§1–§9, Vorgänger), ergänzt am **2026-11-25** (§10–§13, Phase 1), beobachtete Spielversion **v3.8** (`PATCH_NOTES[0].version`, Patch-Datum 2026-11-20),
Bundle `js/bundle.d97633119f.js`. Alles hier wurde live mit Playwright (Chromium) gegen https://pokelike.xyz
beobachtet, einmal mit frischem Profil (nur Kanto offen) und einmal mit einer **bereinigten Kopie** eines echten
Spielstands (alle Regionen offen, Sprache Deutsch). Wiki-Seiten waren nur Hinweise; maßgeblich ist das hier.

## 1. Technik

| Frage                     | Ergebnis                                                                                                                                                                                                                                                                                                                                                        |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DOM oder Canvas?          | **DOM.** Jeder Bildschirm ist ein `<div class="screen">` mit fester ID; der aktive trägt `.active`. Karte = SVG im DOM. Nur Kampf-Effekte (`BattleFX`) nutzen Canvas – irrelevant.                                                                                                                                                                              |
| Framework                 | **Keins** (Vanilla-JS, ein klassisches Script, kein Modul). Der Code ist mit einem String-Array-Obfuscator verschleiert (`OcH(0x1234)`), aber **alle Top-Level-Funktionen sind als globale Funktionen sichtbar** (~2100, z. B. `showScreen`, `onNodeClick`, `doCatchNode`, `getTypeEffectiveness`, `getBestMove`, `calcDamage`, `getSettings`, `saveSettings`). |
| Globaler Spielzustand     | Lexikalische Top-Level-Variable **`state`** (kein `window.state`, aber per `eval('state')` / direkter Referenz im Hauptkontext lesbar). Daneben `window._currentScreenId`, `TYPE_CHART`, `__POKEDEX__` (792 Spezies mit Typen/Basiswerten), `PATCH_NOTES`, `endlessState`.                                                                                      |
| Speicherstände            | **localStorage**, Schlüssel `poke_*` (z. B. `poke_current_run`, `poke_settings`, `poke_pokedollars`, `poke_dex`, `poke_hall_of_fame`, `poke_parked_run:endless2`, `poke_stat_buffs`) und `pkrl_*` (Spezies-Cache). Kein IndexedDB. Cloud-Sync optional über `poke_save_token`.                                                                                  |
| Isolierte Welten          | Content-Scripts (isolierte Welt) sehen `state` **nicht** ⇒ eine Bridge im Hauptkontext ist nötig (Chrome: `world: "MAIN"`; Userscript: `<script>`-Element).                                                                                                                                                                                                     |
| CSP                       | `object-src 'none'; base-uri 'self'; frame-ancestors 'self'` – **kein `script-src`**, Inline-Script-Injektion funktioniert.                                                                                                                                                                                                                                     |
| Anti-Tamper               | Objekt `pk` mit `storageDigest()`; beim Import einer bereinigten Kopie in ein neues Profil blieb `pk.active === false`, nichts wurde verworfen. Erlaubte Hosts stehen in `__pkl_allowed`. Der Bot **schreibt nie** in die Schlüssel des Spiels (`poke_*`, `pkrl_*`) und patcht keine Spielfunktionen. Einzige Ausnahme ist der eigene Fallback-Speicher des Userscripts unter `pkbot.*` ohne GM (D-031, §12.9).                                                                                            |
| Speichern mitten im Kampf | **Nein.** Reload während eines Kampfes ⇒ der Run war nicht fortsetzbar (Resume-Button weg). Bot darf während `battle-screen` nie neu laden.                                                                                                                                                                                                                     |
| Sprache                   | UI ist übersetzt (en, es, de, pt, it, fr, zh, ja). **Texte sind für Erkennung unbrauchbar** – nur IDs, Klassen, `data-*`, Sprite-Pfade und `state` verwenden. Spezies-/Itemnamen sind in `state` immer Englisch.                                                                                                                                                |
| Tastenkürzel              | Viele Buttons tragen `data-shortcut` (`1`…`6`, `Space`); Anzeige über Setting `showShortcuts`.                                                                                                                                                                                                                                                                  |

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

| Screen-ID                | Bedeutung                                     | Erkennung / Aktionen                                                                                                                                                                                                                    |
| ------------------------ | --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `title-screen`           | Titel                                         | `#btn-history-run` (Story), `#btn-continue-run` (Resume Story), `#btn-endless-run` (Tower), `#btn-continue-endless`, `#btn-challenges-run`, `#btn-continue-challenge`, `#btn-pokechain` (Daily Pokésort), `#btn-multiplayer` (disabled) |
| `history-region-select`  | Story: Modus + Region                         | `#btn-history-classic`, `#btn-history-nuzlocke` (Klasse `--selected`), `.history-region-btn` (gesperrt: `.history-region-btn--locked`), Reihenfolge Kanto, Johto, Hoenn, Sinnoh, Unova, Kalos                                           |
| `endless-stage-select`   | Battle Tower                                  | `#btn-tower-normal`, `#btn-tower-hardcore`, `.history-region-btn` (Kanto … Kalos, ORAS)                                                                                                                                                 |
| `trainer-screen`         | Charakter                                     | `#trainer-boy`, `#trainer-girl`                                                                                                                                                                                                         |
| `starter-screen`         | Starter                                       | Karten in `#starter-choices`                                                                                                                                                                                                            |
| `map-screen`             | Karte                                         | SVG `g.map-node[data-node-id]`, klickbar: `.map-node--clickable`; Team-Slots `.team-slot.team-slot-reorder` (Klick-Klick tauscht Positionen)                                                                                            |
| `battle-screen`          | Kampf (Wild/Trainer/Arena/Elite)              | `#btn-auto-battle` (Skip), danach `#btn-continue-battle` (manchmal geht es ohne Button weiter)                                                                                                                                          |
| `catch-screen`           | „Wild Pokémon Appeared“                       | Karten `#catch-choices .poke-card` (Reihenfolge = `state.savedCatch.instances`), `#btn-skip-catch`                                                                                                                                      |
| `item-screen`            | „Item Found“                                  | `#item-choices .item-card` (Item-ID = Dateiname von `img.item-sprite-icon`), `#btn-skip-item`                                                                                                                                           |
| `passive-screen`         | Relic/Passive                                 | `#btn-skip-passive`; Wahl-Karten (Inhalt noch nicht live gesehen)                                                                                                                                                                       |
| `swap-screen`            | „Team Full“                                   | `#swap-incoming .poke-card` (neues), `#swap-choices .poke-card` (Freilassen), `#btn-cancel-swap` (behalten)                                                                                                                             |
| `trade-screen`           | „Trade Offer“                                 | `#trade-team-list li.trade-member-row`, `#btn-skip-trade`, `#btn-trade-continue`                                                                                                                                                        |
| `shiny-screen`           | Shiny-Event                                   | `#btn-take-shiny`, `#btn-skip-shiny`                                                                                                                                                                                                    |
| `badge-screen`           | „Badge Earned“                                | `#btn-next-map`                                                                                                                                                                                                                         |
| `elite-prep-screen`      | Boss-/Elite-Vorbereitung, „Choose Your Order“ | `#elite-prep-player-side .battle-pokemon[data-idx]` (Pointer-Drag tauscht), `#btn-elite-prep-continue` (FIGHT!)                                                                                                                         |
| `transition-screen`      | Übergang                                      | warten                                                                                                                                                                                                                                  |
| `gameover-screen`        | Game Over                                     | `#btn-retry` (Play Again), `#btn-gameover-menu`                                                                                                                                                                                         |
| `win-screen`             | Champion                                      | `#btn-play-again`, `#btn-win-home`, Share, Climb the Tower, Hall of Fame                                                                                                                                                                |
| `stat-buff-screen`       | Tower-Buff                                    | `#btn-skip-statbuff`                                                                                                                                                                                                                    |
| `endless-stage-complete` | Tower-Stufe geschafft                         | `#btn-stage-continue`, `#btn-stage-again`, `#btn-stage-home`                                                                                                                                                                            |

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
- Knotentypen beobachtet: `start, catch, battle, trainer, question, item, trade, pokecenter, move_tutor, boss` (+ weitere laut Code: legendary, shiny, pokemart …).
  - **Nachtrag 2026-11-27 (Spielcode v3.8, `NODE_TYPES`):** `start, battle, catch, item, question, boss, pokecenter, trainer, legendary, move_tutor, trade, pokemart, mutation, evilteam, silver, moonstone, levelup, magma, aqua, rival_n, sycamore, korrina, masterball, lysandre, underground, distortion, reward` und weitere. Der Mart heißt `pokemart` (nicht `poke_mart`, D-042). In den Arena-Challenge-Messungen kamen nur `trainer, battle, boss, question, item, move_tutor, pokecenter, catch, legendary, trade` vor.
- `state.savedCatch = {nodeId, instances[], rerollPool, level}` – die angebotenen Fänge.
- Angriff: `getBestMove(types, baseStats, moveTier)` → `{name, power, type, isSpecial}`.
- Typen: `TYPE_CHART[atk][def]` (18 Typen inkl. Fee), `getTypeEffectiveness(atkType, defTypes[])`.

## 7. Offene Fragen
_Stand 2026-11-25: teilweise überholt, siehe §10.1a. Was noch offen ist, steht gebündelt in §13._

- Relic-/Passive-Screen, Shop/Pokémart, Entwicklungs-Overlays, Top 4/Champ und Tower-Stat-Buff noch nicht live gesehen → Bot pausiert dort bis zur Implementierung („niemals raten“).
- Pokésort: Lösungslogik nicht umgesetzt (Modal `pokechain-modal`).
- Ob `runBattle` gefahrlos zur Simulation genutzt werden kann (Nebenwirkungen auf `state`/RNG) – bewusst nicht verwendet.

## 8. Spielmechanik (aus dem Spielcode gelesen, v3.8)

Alle Angaben stammen aus den dekodierten Spielfunktionen (Namen in Klammern) und wurden live gegengeprüft.

### Erfahrung und Level

- **Jeder gewonnene Kampf gibt allen lebenden Mitgliedern +2 Level** (`getLevelGain` liefert konstant 2, `applyLevelGain`),
  egal ob Wild, Trainer oder Boss (Level-Cap 100). **Besiegte bekommen nichts – außer sie wurden in diesem Kampf eingesetzt** (Teilnehmer leveln mit, bleiben aber K.o.). Lucky Egg: 30 % +1. Relic „Exp. Share“: das
  niedrigste lebende Mitglied +1.
- Folge: Mehr Mitglieder verwässern keine XP. Wildkämpfe bringen gleich viel XP wie Trainer, sind aber leichter.
- Entwicklungen erfolgen per Level (`checkAndEvolveTeam`, Tabelle `EVOLUTIONS`). Eviolite verhindert sie.

### Gegnerstärke (Kanto, `MAP_LEVEL_RANGES`)

| Map        | 1   | 2    | 3     | 4     | 5     | 6     | 7     | 8     | Top 4 |
| ---------- | --- | ---- | ----- | ----- | ----- | ----- | ----- | ----- | ----- |
| Wild-Level | 1–5 | 8–15 | 14–21 | 21–29 | 29–37 | 37–43 | 43–47 | 47–52 | 53–64 |

- Innerhalb einer Map steigt das Level mit der Ebene: min + (Ebene−1)/6·(max−min) + Zufall (`getLevelForNode`).
- Wilde Pokémon ab Map 2 sind 1 Level niedriger. Trainer haben 1 Pokémon auf Map 1, 2 auf Map 2–3, danach 3 (`doTrainerNode`).
  Trainer mit Spezialtyp (z. B. `fireSpitter`) ziehen aus typisierten Pools.
- Auf Map 1, Ebene 1 werden nur Wildgegner gewählt, die den Starter nicht sehr effektiv treffen (`doBattleNode`).

### Arenaleiter und Top 4 Kanto (`GYM_LEADERS`, `ELITE_4`)

| Boss                                                                                          | Team (Level, Item)                                                                   |
| --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Brock (Gestein)                                                                               | Geodude 12, Onix 14                                                                  |
| Misty (Wasser)                                                                                | Staryu 18, Starmie 20                                                                |
| Lt. Surge (Elektro)                                                                           | Pikachu 20 (Eviolite), Voltorb 23 (Magnet), Raichu 25 (Life Orb)                     |
| Erika (Pflanze)                                                                               | Tangela 26, Victreebel 31, Vileplume 32                                              |
| Koga (Gift)                                                                                   | Koffing 38 ×2, Muk 40, Weezing 44                                                    |
| Sabrina (Psycho)                                                                              | Mr. Mime 40, Venomoth 41, Kadabra 42, Alakazam 44                                    |
| Blaine (Feuer)                                                                                | Ponyta 47, Growlithe 47, Rapidash 48, Arcanine 53                                    |
| Giovanni (Boden)                                                                              | Dugtrio 55, Nidoqueen 53, Nidoking 54, Rhyhorn 56, Rhydon 60                         |
| Top 4                                                                                         | Lorelei (Eis) 53–56, Bruno (Kampf) 53–58, Agatha (Geist) 54–58, Lance (Drache) 56–62 |
| Champ Gary                                                                                    | Pidgeot 61, Alakazam 59, Rhydon 61, Exeggutor 61, Charizard 65                       |
| Die Top 4 kämpfen ohne Heilung dazwischen hintereinander (`doElite4`, `inEliteFourGauntlet`). |

### Kampf

- 1-gegen-1, der jeweils erste lebende Pokémon jeder Seite kämpft (`runBattle`). Der ganze Kampf wird **sofort berechnet**,
  die Animation läuft danach.
- Werte wie in Gen 1 ohne IV/EV: ⌊Basis·Level/50⌋+5 (`getEffectiveStat`). Physisch oder speziell nach dem höheren
  Angriffswert (`usesSpecialAttack`).
- Schaden: ⌊(2·Lv/5+2)·Stärke·A/V/50+2⌋ × Typ × STAB 1,5. Items: Typ-Booster ×1,4, Choice Band ×1,4 (Vert. ×0,8),
  Choice Specs ×1,3, Expert Belt ×2 bei sehr effektiv, Lagging Tail ×2 (immer zuletzt), Eviolite Vert./SpVert. ×1,5 bei
  entwicklungsfähigen Pokémon (`calcDamage`). Items wirken nur gehalten (`heldItem`).
- Attackenstufe (`getMoveТierForMap`, mit kyrillischem „Т“ im Namen!): Map 1–2 Stufe 0, Map 3–7 Stufe 1, ab Map 8 Stufe 2.
  Gefangene Pokémon behalten ihre Stufe, der Move-Tutor erhöht sie.
- Zufall: ein gesäter globaler Generator (`rng`, `seedRng`, `getRngSeed`).

### Knoten

- Pokécenter: alle Mitglieder voll geheilt, **auch Besiegte** (`doPokeCenterNode`).
- „?“ (`resolveQuestionMark`): 22 % Wildkampf, 20 % Trainer, 10 % Fang (Nuzlocke: Kampf), 13 % Item, 7 % Shiny, Rest „Mega“.

### Simulation durch den Bot

Die Bridge ruft `runBattle` mit tiefen Kopien auf und stellt RNG-Seed und `_pokeUidCounter` danach exakt wieder her.
Live geprüft: `state`, Seed und Zähler waren nach 280 Simulationen identisch, Dauer 57 ms.
**Bewusste Grenze:** Der Bot simuliert nur mit eigenen Seeds (Verteilung). Den gesäten Zufall nutzt er nie, um den echten
nächsten Gegner oder Kampfausgang vorherzusagen, denn das wäre Wissen, das kein Mensch hat.

## 9. Challenges (Arena-Challenge, Täglich, Wöchentlich, Endlos)

Live erfasst mit einer bereinigten Kopie eines echten Spielstands (1724 Challenge-Läufe, 206 Siege).

| Bildschirm                              | Erkennung                                       | Aktionen                                                                                                                                                                                                                                       |
| --------------------------------------- | ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `challenge-select`                      | Herausforderungsläufe                           | `#chal-intro` (Arena-Challenge), `#chal-endless2` (Endlos), `#chal-weekly`, `#chal-daily`, `#chal-records-btn`                                                                                                                                 |
| `weekly-select` (`.weekly-select--gym`) | Ordensstufe der Arena-Challenge                 | `.gym-pick[data-level=0..7]` (`.is-earned`, `.is-sel`, `.is-locked`), `.gym-play`. Jede Stufe bringt eine neue Regel (z. B. Stufe 3: wilde Pokémon +3 Level) und Pokédollar.                                                                   |
| `starter-screen` mit `.pc-box`          | Starter aus dem eigenen PC                      | `.dex-card` (Sprite-Pfad = Art, `shiny/`/`aurora/`; `.pc-buff-stars[title="50 Buff-Punkte"]` = Vitamin-EVs; `.pc-mega-badge` = Mega-Stein startet ausgerüstet), Filter nach Generation/Typ                                                     |
| `passive-screen`                        | Start-Relikt, danach ein Relikt nach jedem Boss | `#passive-choices .item-card.passive-card` (Typ über `.kw-<Type>`-Klassen, `.item-tag--starter`), `#btn-skip-passive`. Bei vollen Plätzen `.is-replace-grid`: vorhandene Relikte klicken = ablegen, das neue (nicht klickbar) und Überspringen |

**Interner Zustand:** Die Arena-Challenge läuft über den Endless-Mechanismus: `state.isEndlessMode = true`,
`state.challengeId = "intro"`, `state.challengeBadge` (Ordensstufe), Relikte in `state.passives`
(+ `state.runBuffs`), Start-Relikt `state.startingItemId`. `endlessState.currentRegion.trainers[0..2]` beschreibt die
drei Bosse der aktuellen Region (Archetyp/Typ, Level, `speciesIds`/`fetchIds`, `levelOffsets`, `teamSize`, Items,
Mega-/Shiny-/Hidden-Slots, Talent-Vorgaben, ggf. `gauntlet`); `endlessState.wtOuterTypes` die Boss-Typen aller 9 Karten.

**Kämpfe mit Talenten und Relikten** (`runBattleScreen`, `runEndlessTrainerFight`):

- Spieler: `computeTraitTiers(team, 0, passives, gegner)`, die Typen im Team (Shinys zählen doppelt) ergeben Talentstufen.
- Wilde Gegner: keine Talente. Trainer: `computeTraitTiers(gegner, 0)`, sobald Ordensregel 1 gilt (`chalBadgeRule(1)`).
- Bosse: je nach Spezifikation `allTraits`, `specificTraits`, gespiegelte Spieler-Talente oder `computeTraitTiers(team, traitBonus)`,
  danach `traitOverrides` und `maxTraitTier`.
- `buildTraitsConfig(spieler, gegner, [...passives, ...runBuffs])` wird an `runBattle` übergeben. Bei Gen-3+-Challenges
  kommt die Fähigkeiten-Konfiguration hinzu.
- Trainerteams auf normalen Knoten: `ENDLESS_TEAM_SIZES[stage] − 1`.

Der Simulator bildet das alles nach, daher wirken Relikte und Talente in den simulierten Kämpfen wie in den echten.

## 10. Ergänzungen aus der Einrichtungs-Session (2026-11-25)

Dieser Abschnitt kam in der Einrichtungs-Session hinzu, als der Hauptauftrag zerlegt wurde. Die Abschnitte 1 bis 9 stammen aus dem Vorgänger-Branch (D-016) und wurden live geprüft.

### 10.1 Abgleich mit HA §1 („live prüfen, nicht blind übernehmen“, R-036). Stand: v3.8, geprüft am 2026-11-25
| Angabe im Hauptauftrag | Stand laut Abschnitten 1 bis 9 |
|---|---|
| Autobattler, Kämpfe laufen automatisch | **bestätigt**: Der Kampf wird sofort komplett berechnet (§8 Kampf) |
| Modi Story (Classic/Nuzlocke, Regionen), Tower (Normal/Hardcore), Challenges, Pokésort, Multiplayer „Coming Soon“ | **bestätigt** (§4: `title-screen`, `history-region-select`, `endless-stage-select`, §9) |
| Run-Ablauf Charakter → Starter → Karte → Orden → Next Map → Top 4 → Champ | **bestätigt** (§4) |
| Bildschirme Wild, Item, Relic, Team Full, Trade, Badge, Choose Your Order, FIGHT!, Game Over, Champion | **bestätigt** (§4, §9). Top 4 und Champ wurden live gespielt (Champion-Sieg, STRATEGY.md). Shop/Pokémart und einzelne Entwicklungs-Overlays sind **offen** |
| Der erste lebende Pokémon kämpft zuerst | **bestätigt** (`runBattle`, §8) |
| Gehaltene Items können **Angriffstyp** und Wirkung ändern | **bestätigt** (§12.2). Die 17 Typ-Booster lassen den Träger Angriffe ihres Typs versuchen („attempts X-type attacks if able“), Metronome lässt doppeltypige Pokémon mit ihrem **anderen** Typ angreifen |
| Traits: 2 Punkte pro Stufe, normal 1 Punkt pro Typ, Shiny 2 | **bestätigt** (`computeTraitTiers`, §12.3): Stufe = min(`TRAIT_MAX_TIER`, ⌊Punkte/2⌋ + Bonus). Grundwert 1 Punkt pro Typ und Pokémon, Shiny +1. Dazu kommen weitere +1-Quellen, etwa Legendäre mit Relikt und Reroll-Fänge mit Relikt |
| Level und Sonderbonbons beleben Besiegte nicht | **bestätigt** (§8 „Besiegte bekommen nichts“) |
| Nuzlocke: ein Fang pro Zone, Besiegte sind weg | **teilweise**. „Besiegte sind weg“ bestätigen das Wiki (§11, Nuzlocke-Challenge) und pokelike-guide.fr. **„Ein Fang pro Zone“ steht auf pokelike-guide.fr** („Permadeath on faints, one catch per zone“ für den Nuzlocke-Modus), das Wiki nennt nur Varianten mit einem Fangknoten pro Karte. Im Code ist das noch zu prüfen (P4). Aus §12.4: Im Nuzlocke wird auf festem Level gefangen (`nuzlockeCatchLevel` = Mitte von `MAP_LEVEL_RANGES[currentMap]`), „?“ führt zum Kampf statt zum Fang (§8). „Ein Fang pro Zone“ und Permadeath sind im Code noch nicht belegt, das ist eine Aufgabe für P4 (R-062) |
| Battle Tower: Start mit freigeschalteten Pokémon, Stage Select | **teilweise**: Die Region bzw. Stufe wird in `endless-stage-select` gewählt (§4). Ob der Tower-Starter aus dem PC kommt, ist nur für Challenges belegt (§9). Für den Tower ist das **offen** (§13) |
| Champion-Bildschirm mit Play Again, Share, Climb the Tower, Home | **teilweise**: Laut Markup bzw. §4 gibt es `#btn-play-again`, `#btn-win-home` und `shareRun()` (Fixtures mit Run-Menü). Ein `win`-Fixture fehlt (§13) |
| Sonderbonbons beleben nicht wieder | **bestätigt**: `rare_candy` = „Gives a Pokémon +3 levels“ (`USABLE_ITEM_POOL`), wiederbeleben kann nur `sacred_ash` (§12.2). Besiegte bekommen kein Level (§8) |
| Daily Pokésort: 6 Pokémon so ordnen, dass jede Verbindung passt | **teilweise**: Der Modus existiert (Hauptmenü §10.6, `pokechain-modal` §5, Spielstand `poke_pokechain` §2). Die Regel „jede Verbindung passt“ ist nicht live geprüft. pokelike-guide.fr bietet eine tägliche Lösung (§11). **Offen** bis zum Löser (R-144, P7) |
| Resume-Buttons | **bestätigt**: `#btn-continue-run`, `#btn-continue-endless` und `#btn-continue-challenge` auf `title-screen` (§4), behandelt in `engine.ts:90-101`. Runs mit Speicherstand werden fortgesetzt (Speicherzeitpunkte §12.6) |
| Tower: dauerhafte EV-Upgrades (Vitamine) für Pokédollar | **bestätigt** (§12.5): `buyVitamin` gibt dauerhafte Pokédollar aus (`spendPokedollars(VITAMIN_COST)`), maximal 10 pro Wert, mit Gesamtgrenze `getVitaminCap()`. Der Kauf wird dauerhaft gespeichert und synchronisiert (`savePersistentBuffs`, `syncToCloud`). **Fällt unter R-237** |

### 10.1a Teilweise überholte Angaben in §7
§7 stammt aus einem früheren Stand des Vorgängers. **Überholt:** „`runBattle` … bewusst nicht verwendet“. Der Simulator nutzt es inzwischen, siehe §8 „Simulation durch den Bot“ und D-019. Ebenfalls überholt ist „Relic/Passive … Top 4/Champ noch nicht live gesehen“: Relikte sind in §9 live erfasst, Top 4 und Champ wurden live gespielt. Weiterhin offen sind Shop/Pokémart, einzelne Entwicklungs-Overlays, der Tower-Stat-Buff und der Pokésort-Löser.

### 10.2 localStorage-Schlüssel mit Zugangs- und Personendaten (R-148, D-013)
Diese Schlüssel liest, loggt und exportiert der Bot **nie**. In Fixtures haben sie nichts zu suchen:
`poke_save_token`, `poke_save_token_exp` (Cloud-Save), `poke_save_owner`, `poke_username`, `poke_soul_link_live` (Spieler- und Tab-UUID), `poke_run_sync` (Fingerprint), dazu die Consent-Daten (`CMPList`, `_cmpRepromptHash`, `gbc_consent`, `noniabvendorconsent`, `_acceptanceState`, `_cmpShown`, `gdpr_encoding_modes`) und `visitTimestamp`.
Ein echter Spielstand enthält außerdem `poke_progress_backup` (Kopie des Fortschritts), `poke_last_cloud_sync` sowie Verlaufs- und Kontodaten (`poke_hall_of_fame`, `poke_challenge_stats`, `poke_pokedollars`, `poke_dex` …).

### 10.3 Fixtures aus dem Spielstand des Nutzers
- `tests/fixtures/state/run-samples-v3.8.json` (eingecheckt): enthält nur `poke_current_run`, `poke_parked_run:endless2`, `poke_settings` und `poke_patch_intro_seen` als localStorage-Strings, anonym. Das Beispiel ist ein Johto-Nuzlocke-Run in einer Wochen-Challenge (`mega-johto`) mit Karte (Knoten, Kanten, Ebenen), Team mit KP, Items, dazu ein geparkter Endless2-Run mit `endless`-Zustand.
- Der vollständige bereinigte Spielstand liegt nur lokal unter `tests/fixtures/private/` (gitignored, R5.4). In einer neuen Session ist er nicht mehr vorhanden.

### 10.4 WebKit in der Cloud (D-011, D-026)
**Gelöst am 2026-11-25:** WebKit (`webkit-2359`) läuft samt Systembibliotheken (`npx playwright install-deps webkit`). Die E2E-Suite ergab 17 bestanden und 1 gewollt übersprungen (R-065). Neue Sessions bekommen WebKit über das Setup-Skript der Umgebung (D-026).

### 10.5 Weitere offene Fragen (zusätzlich zu §7). Stand 2026-11-25: Frage 1, 2 und 5 sind beantwortet, 3 und 4 teilweise, der Rest steht in §13
1. ~~Ändern bestimmte Items den Angriffstyp, etwa Platten oder Typ-Items?~~ **Ja (§12.2).** Das betrifft R-059 und R-118.
2. ~~Liegt die Trait-Schwelle wirklich bei 2 Punkten pro Stufe?~~ **Ja (§12.3).** Das betrifft R-060.
3. Wie gehen die Nuzlocke-Regeln im Code und live? **Teilweise (§12.4, §11), Rest in §13 Nr. 5.** Das betrifft R-062.
4. Mit welcher Währung bezahlt man im Shop bzw. Pokémart während eines Runs? Ist das dieselbe wie die dauerhaften Pokédollar? **Teilweise (§12.5): Vitamine kosten dauerhafte ₽, der Mart-Knoten vermutlich nicht, Rest in §13 Nr. 7.** Das betrifft R-136 und R5.1/D-017.
5. ~~Wo stellt man den Starter für die Story ein?~~ **Auf `starter-screen` (§12.7).** Das betrifft R-138 und R-160.

### 10.6 Obere Leiste, Run-Menü und Hauptmenü
Diese Angaben stammen aus der Vorab-Aufklärung in Session 1 (Hauptmenü headless, frisches Profil, englische UI). Die Selektoren `#run-menu-toggle`, `.run-menu-btn[data-menu=…]`, `data-shortcut="R"`, `confirmResetRun`, `#btn-fullscreen` und `#btn-mart-nav` sind am 2026-11-25 in allen 29 DOM-Fixtures geprüft. Das Modal `reset-run-modal` steht nur in der Modal-Liste (§5), in keinem Fixture. Die Elemente sind auf jedem Bildschirm vorhanden, deshalb darf das Overlay sie nie verdecken (R-002).
- **Run-Menü:** `#run-menu-toggle` öffnet die Liste `.run-menu-btn[data-menu=…]` mit den Werten `home`, `menu`, `pokedex`, `items`, `achievements`, `hof`, `pc`, `settings`, `patch`, `credits`, `discord`, `account` (Login bzw. Logout) und **`reset`** („Reset Run“, ruft `confirmResetRun()` auf, Modal `reset-run-modal`, **Tastenkürzel `R`** über `data-shortcut="R"`). Der Bot klickt `reset` und `account` nie ohne ausdrückliche Erlaubnis und sendet **nie die Taste `R`** (R-147). Das gilt auch für Tastenkürzel wie den Lead-Tausch per Shift+Ziffer. Spieleinstellung `skipResetConfirm` beachten (R-226).
- **Obere Leiste:** Geld (₽), `#btn-fullscreen` (Vollbild), `#btn-mart-nav` (Poké Mart), dazu Pokédex, PC und Einstellungen. Auf dem Desktop kommen Achievements und Mega Bracelet hinzu, auf dem iPhone liegt die Navigation hinter dem Hamburger-Menü („Open menu“).
- **Hauptmenü (frisches Profil):** Die Modi heißen Story („PLAY STORY“), Battle Tower („ENTER TOWER“), Challenges („TAKE CHALLENGE“, im frischen Profil gesperrt, R-227), Multiplayer („COMING SOON“) und Daily Pokésort (₽500, täglich neues Rätsel). Die Desktop-Navigation umfasst HOME, POKÉDEX, ITEMS, ACHIEVEMENTS, HALL OF FAME, PC, LOGIN / SIGNUP, PATCH NOTES, SETTINGS, CREDITS und DISCORD.
- **Sicherheits-Header:** CSP wie in §1, dazu `X-Frame-Options: SAMEORIGIN`. Ausgeliefert wird über Cloudflare, mit Google Analytics und einem Consent-Manager (CMP/TCF).

### 10.7 Weitere offene Fragen aus der Vorab-Aufklärung
1. ~~Gibt es zusätzlich eine Meta-CSP im HTML?~~ **Beantwortet (§12.1): nein**, nur eine `Permissions-Policy`.
2. Wann schreibt das Spiel `poke_current_run` in den localStorage, nach jeder Aktion oder nur an Speicherpunkten? **Beantwortet (§12.6).** Das ist wichtig für Resume (R-194) und R-241.
3. Wie zeigt das Spiel den nächsten Boss an (Boss-Vorschau, Einstellung `hideBossPreview`, R-121)? **Teilweise beantwortet (§12.7, `bossPreviewMon`).** Die Darstellung im DOM ist noch offen (P4).

## 11. Externe Quellen (R-064), abgerufen am 2026-11-25
Sie sind **nur Hinweise**. Maßgeblich ist das Spiel (§12). Alle Seiten sind ein Fan-Projekt ohne gefundenen Lizenztext. Übernommene Daten brauchen deshalb eine Quellenangabe, und vor einer Übernahme (P4, R-221) sind `/sources/`, `/disclaimer/` und `/methodology/` zu prüfen.

| Quelle | Inhalt | Stand laut Seite | Abgleich mit dem Spiel |
|---|---|---|---|
| https://pokelike.wiki/guides/kanto/ | Tabellen: 8 Arenen, Top 4 und Champ Gary mit Pokémon, Level und „Ace-Item“, Fänge pro Kartenabschnitt | Client gelesen am 17.09.2026, Version nicht angegeben | Die Teams decken sich mit §8 (z. B. Brock Geodude 12 und Onix 14). Neu ist die **Ace-Regel**: Im Kanto-Story-Kampf behält nur das höchstlevelige Gegner-Mitglied sein Item, bei Gleichstand das später stehende. Das ist im Code zu prüfen (P4) |
| https://pokelike.wiki/battle-tower/ | 7 Stufen (Kanto bis ORAS) mit je 9 festen Gegnern, also 63 Teams, die Details auf Unterseiten. Belohnung 200 bis 1100 ₽ pro Sieg | v3.5, importiert am 19.10.2026 | Vitamine kosten **200 ₽**, „Free reset removes the allocation without refunding coins“, 10 Punkte pro Stufe, höchstens 50 pro Linie und 10 pro Wert. Sie gelten **nur im Tower und in Challenges**, nicht in der Story. Das passt zu `buyVitamin` (§12.5) |
| https://pokelike.wiki/traits/ | 18 Typ-Traits mit Stufen T1 bis T6 (ca. 108 Effektzeilen), Punktregeln mit Beispielen | Kopf „Official v3.6 · 2026-11-01“, Karten teils v3.1 | **Bestätigt §12.3**: „A normal Pokémon contributes 1 point to each type; Shiny adds 1 and Mutant adds 1 more“, Stufe = ⌊Summe/2⌋. Das Spiel kennt laut Seite bis T12 |
| https://pokelike.wiki/items/ | Katalog mit 164 Einträgen (36 Items, 128 Passive), Effekttext, Modus, Stapelregel meist „not established“ | v3.1, importiert am 12.09.2026 | **Bestätigt §12.2** (Typ-Items „attempts X-type attacks if able“). Das Spiel hat inzwischen 37 Items, 256 Relikte und 4 nutzbare (v3.8), die Seite ist also veraltet |
| https://pokelike.wiki/ | Startseite, Verweise u. a. auf `/challenges/` („twelve permanent rules“) und `/guides/evs-and-vitamins/` | – | Die Unterseiten `/challenges/`, `/battle-tower/kanto/` und `/guides/evs-and-vitamins/` sind ausgewertet (Zeilen unten) |
| https://pokelike.wiki/battle-tower/kanto/ | 9 feste Gegner in Kartenreihenfolge (Erika, Misty, Flint, Falkner, Bugsy, Lorelei, Sabrina, Agatha, Ash Ketchum), Team in Kampfreihenfolge mit Level, Trait-Regel („Team-computed Traits“, bei Ash „+ 1 Tier bonus“). Keine Items je Gegner | v3.5, geprüft am 19.10.2026 | Beispiel: „1 \| Erika \| Bellsprout Lv.7; Bulbasaur Lv.8“. Ein Clear gibt 200 ₽ und öffnet Johto. Für Tower-Gegnerdaten in P4 gegen `endlessState` prüfen (R-090) |
| https://pokelike.wiki/challenges/ | 12 Dauerregeln: Monotype, Wish Upon a Star, Trick Room, Nuzlocke, Inverse World, Legendary Opposition, Arena Floors, Ride or Die, Little League, Walk It Off, Wanted, Ultimate Challenge. Dazu Belohnungen (Clear 1.000 ₽, Daily 2.000/500 ₽) | Regeln v3.5 (19.10.2026), Snapshot v3.6 (01.11.2026) | **Nuzlocke-Challenge**: „A Pokémon that faints is lost for the rest of this run.“ Von **„ein Fang pro Zone“ steht dort nichts**, nur „one catch node per map“ bei Nuzlocke Randomizer und „one catch per map“ bei einem Weekly. Relevant für R-062 und R-234 (Challenge-Regeln je Art) |
| https://pokelike.wiki/guides/evs-and-vitamins/ | Vitamine: HP Up, Protein (ATK und SpATK gekoppelt), Iron, Zinc, Carbos | v3.5, geprüft am 19.10.2026 | Die Angaben: 200 ₽ pro Punkt, +5 % pro Punkt, höchstens 10 pro Wert, Gesamtgrenze pro Entwicklungslinie = min(10 × höchste geschaffte Tower-Stufe, 50). Ein kostenloser EV-Reset im Poké Mart erstattet nichts. Gilt für Tower- und Challenge-artige Runs, **nicht gleichermaßen für die Story**. Passt zu §12.5 (R-063, R-137, R-237) |
| https://pokelike-guide.fr/ (gerendert mit `scripts/recon/read-guide.mjs`: `/en/`, `/en/nuzlocke/`, `/en/mechanics/`, `/en/donnees/`, `/en/battle-tower/`, `/en/normal/`. Beleg: `docs/superpowers/audits/2026-11-25-guidefr-pages.json`) | **JS-gerendert**, in Chromium geprüft am 2026-11-25. **Nuzlocke:** „Permadeath“, „One catch per zone“, „Story generations only“ (Gen I–III). **Mechanik:** Economy und Poké Mart (Shiny Egg, Legendary Egg, Vitamine), Reihenfolge und Item-Platzierung, Typentabelle Gen 6, EVs. **Daten-Hub:** Pokédex (649, Gen I–V), Items (laut Seite 165: 128 Passive, 33 Held, 4 Verbrauchsitems. Das Spiel v3.8 hat 256 Passive bzw. Relikte, 37 Held und 4 nutzbare, die Seite ist also älter), Typ-Boni „12 tiers at +2 points per tier“ mit Shiny-Bonus. **Tower:** 5 Regionen erst nach einem Story-Sieg, ₽200 bis ₽800 pro Stufe, „legendaries caught during runs never join the Tower PC“. Die Tower-Regionsseiten mit Gegner-Teams sind spoiler-gesperrt (🔒) und werden in P4 ausgewertet (R-090, D-030). Inoffizieller Guide mit den Bereichen Normal, Nuzlocke, Battle Tower, Challenge, Basics, Mechanics, Tips, Data, Videos und Pokésort (tägliche Lösung), mehrsprachig (en, fr, de, ko, it, es) | ohne Versionsangabe auf der Startseite | Modus-Beschreibungen: Normal „8 badges then Champion“, **Nuzlocke „Permadeath on faints, one catch per zone“**, Battle Tower „Post-Champion endgame by region (Kanto → Unova)“. Die restlichen Unterseiten (Tower-Regionen, Daten-Details) sind in P4 auszuwerten (R-062, R-090, R-221, D-030) |

Zu Nuzlocke: Das Wiki bestätigt nur „Besiegte sind weg“ (Nuzlocke-Challenge). pokelike-guide.fr nennt für den Story-Nuzlocke **beide** Regeln: „Permadeath“ und „One catch per zone“, nur in Gen I bis III. Wie der Code das umsetzt, wird in P4 geprüft (R-062).

## 12. Phase-1-Befunde (Spielcode, nur lesend gelesen, v3.8 vom 2026-11-20, abgerufen am 2026-11-25)
Quelle: `scripts/recon/read-game.mjs` (frisches Profil, Cloud-Endpunkte blockiert). Die Ausgabe landet in `artifacts/recon/read-game.json` und ist nicht eingecheckt.

### 12.1 Technik und Version (R-067, R-068, R-069, R-077)
- **Version:** `PATCH_NOTES[0].version = "3.8"`, Patch-Datum `2026-11-20`, `.title-version` = „v3.8“.
- **CSP:** Der Header lautet `object-src 'none'; base-uri 'self'; frame-ancestors 'self'`, dazu `X-Frame-Options: SAMEORIGIN`. Eine **Meta-CSP gibt es nicht**, im HTML steht nur eine `Permissions-Policy` (camera, microphone, geolocation, payment, usb aus). **Ein eingeschleustes `<script>`-Element wird ausgeführt** (Test über `window.__pkCspTest`). Der Weg über ein Seiten-Skript für das Userscript funktioniert also (R-106).
- **Zustand:** `state` ist eine lexikalische globale Variable auf oberster Ebene, nicht `window.state`, und nur im Hauptkontext lesbar (bestätigt §1). Es gibt 1813 globale Funktionen. Gezählt sind die kleingeschriebenen Funktions-Eigenschaften von `window` mit mehr als 3 Zeichen. Die „~2100“ in §1 zählen alle Top-Level-Funktionen, beide Angaben sind also mit ihrer Zählweise korrekt. Die Bildschirme sind 20 `div.screen[id]`: title, trainer, starter, map, battle, catch, item, passive, swap, trade, shiny, badge, transition, elite-prep, gameover, win, stat-buff, history-region-select, endless-stage-select, endless-stage-complete.
- **Speicher:** keine IndexedDB-Datenbank (`indexedDB.databases()` liefert `[]`). Ein frisches Profil hat nur `poke_ach_backfill_v24`, `poke_ach_backfill_v24b` und `poke_storage_migrated_v1`. `poke_current_run` und die übrigen Schlüssel entstehen erst beim Spielen (§2, §10.2).
- **Standard-Einstellungen eines frischen Profils:** alle Auto-Skips aus, `language: "en"`, `darkMode: false`, `hideBossPreview: false`, Musik und SFX an.

### 12.2 Items (R-059, R-118, R-128 bis R-131, R-221)
- Es gibt 37 tragbare Items (`ITEM_POOL`), 4 nutzbare (`USABLE_ITEM_POOL`: `sacred_ash` belebt wieder, auch Besiegte, `rare_candy` gibt +3 Level, `moon_stone` erzwingt eine Entwicklung, `tm_normal` erhöht die Attackenstufe um 1) und 256 Relikte bzw. Passive (`PASSIVE_ITEM_POOL`).
- **Typwechsel:** 17 Typ-Booster (z. B. `charcoal`: „+40% Fire move damage; attempts Fire-type attacks if able“) und `metronome` („Dual-type holder uses its OTHER type for attacks; +20% damage“). Das Relikt `neutralize` macht alle Attacken neutral effektiv. Alle weiteren Item-Effekte stehen in `read-game.json`.
- **XP:** `lucky_egg` gibt mit 30 % Chance +1 Level nach jedem Kampf. Das bestätigt die Vorgabe „Glücks-Ei früh“ (R-130).

### 12.3 Traits (R-060, R-120)
`computeTraitTiers(team, bonus, passives, gegner)` zählt pro Typ und Pokémon Punkte: 1, plus 1 bei Shiny, plus je 1 für zwei weitere Eigenschaften (Felder obfuskiert, vermutlich Aurora/Mutation), plus 1 für Reroll-Fänge mit Relikt, plus 1 für Legendäre mit Relikt. Bei `gem_collector` kommen zwei zusätzliche Typen dazu. Danach gilt Stufe = min(`TRAIT_MAX_TIER`, ⌊Punkte/2⌋ + bonus), Typen mit Stufe 0 entfallen.

### 12.4 Nuzlocke (R-062, R-127)
`nuzlockeCatchLevel()` liefert im Nuzlocke-Story-Modus `round((min+max)/2)` von `MAP_LEVEL_RANGES[currentMap]`, sonst `null`. „Ein Fang pro Zone“ und dauerhaften Tod live bzw. im Code zu belegen, ist Teil von P4.

### 12.5 Pokédollar, Shop und Vitamine (R-136, R-137, R-237)
- `buyVitamin` bezahlt mit **dauerhaften Pokédollar** und speichert dauerhaft (siehe §10.1). Kauft der Bot Vitamine, braucht das immer die Freigabe nach R-237.
- `doPokeMartNode` (Knoten im Run, Endless/ER) tauscht Items aus dem Team-Inventar (ohne Rare Candy) gegen einen Candy-Wert (`erMartCandyValue`). Nach dem Codeausschnitt werden dabei **keine** dauerhaften Pokédollar ausgegeben, live noch zu bestätigen. `openShopModal` (Poké Mart in der oberen Leiste) gehört zum dauerhaften Shop.
  - **Nachtrag 2026-11-27 (Code entschlüsselt, D-042):** Der Mart-Knoten nutzt `#passive-screen` mit. Die Taschen-Items (ohne Sonderbonbon) erscheinen als `#passive-choices .item-card.passive-card` ohne `.passive-band`. Ein Klick verkauft das Item für 1 Sonderbonbon (`ER_MART_CANDY_PER_ITEM`) und baut die Liste neu auf. „Verlassen“ ist `#btn-skip-passive` in `.choice-skip-row`. Es fließen keine Pokédollar. Vorkommen: nur mit `state.challengeEndless2` (Endlos-Challenge), Knotengewicht 1 ab Karte 31 (`ER_NODE_BANDS`). Erkennbar am Knoten `state.currentNode.type === 'pokemart'`. Live noch nicht gesehen.

### 12.6 Speichern und Fairness (R-069, R-194, R-239)
- `saveRun()` schreibt `{...state, currentNodeId, currentNode: null, rngSeed: getRngSeed()}` in den Run-Slot `poke_current_run`, sofern `runWritesAllowed()` gilt. **Der Spielstand enthält damit den echten Zufalls-Seed (`rngSeed`) und `runSeed`.** Das ist verborgenes Wissen: Der Bot darf beides nie für Entscheidungen nutzen (R-239, `sim-seed.ts` ignoriert sie). **Wann gespeichert wird**, haben die Live-Läufe 1 und 2 gemessen (`saveChangesByScreen` in `tests/e2e/live.spec.ts`). Der Spielstand ändert sich bei fast jedem Bildschirmwechsel, Lauf 2 zählte: Karte 66×, Kampf 48×, Item 7×, Elite-Prep 4×, Game Over 2×, Fang 1×. Ein Reload ist also außer im Kampf (§1) nahezu ohne Verlust fortsetzbar (R-194, R-241).

### 12.7 Boss-Vorschau und Starter (R-121, R-138, R-160)
- `bossPreviewMon(boss, i)` berechnet die Vorschau-Pokémon eines Bosses (Level, Entwicklung). Die Boss-Vorschau ist also im Spiel vorhanden, abschaltbar über `hideBossPreview`.
- Der Starter wird auf dem `starter-screen` gewählt (`selectStarter`, Karten in `#starter-choices`). Die Bot-Einstellung „Starter“ (R-160) legt fest, welche Karte er wählt. In Challenges kommt der Starter aus dem PC (§9).

### 12.8 Lange Bosskämpfe und gesperrtes SKIP (Live-Läufe 1 und 2, 2026-11-25, korrigiert nach dem Review-Tor P1)
- **Beobachtung:** Im Arenakampf gegen Erika (Kanto, Karte 3) pausiert der Bot zweimal mit „no effect after clicking #btn-auto-battle[0]“. Laut Screenshot **läuft der Kampf zu diesem Zeitpunkt noch**: Vulpix auf Platz 6 kämpft gegen Vileplume mit 2/90 KP. „SKIP“ ist ausgegraut.
- **Das Kampfende funktioniert:** Nach Brock und Misty (Niederlagen) klickt der Bot korrekt `#btn-continue-battle`, danach folgt der Game-Over-Bildschirm.
- **Muster:** In Bosskämpfen bleibt schon der erste SKIP-Klick ohne Wirkung. Kurze Bosskämpfe enden vor dem dritten Versuch, der lange Erika-Kampf nicht. Das Budget liegt bei etwa 15 s (`bot.ts:42-43, 496-509`).
- **Wahrscheinliche Ursache:** `isShown` (`detector.ts:59-76`) prüft weder `disabled`, `aria-disabled` noch `pointer-events`. Die Engine klickt deshalb SKIP, statt zu warten (`engine.ts:183`). Die Kampfsignatur (`detector.ts:127-131`) enthält keinen Fortschritt wie KP oder Kampflog, deshalb gilt „läuft noch“ als „keine Wirkung“.
- **Offen:** Sperrt das Spiel SKIP in Bosskämpfen generell? Hängt das an `autoSkipBattles` bzw. `autoSkipAllBattles` (§13 Nr. 4)?
- **Geklärt am 2026-11-26 (Live-Aufklärung P3a, MutationObserver auf SKIP/WEITER, 35 Kämpfe, Story Classic Kanto):**
  - **Ablauf jedes Kampfs:**
    1. Etwa 20 ms nach Kampfbeginn wird `#btn-auto-battle` aktiv (`disabled=false`, Deckkraft 1).
    2. Nach dem Klick (bei Tempo 300 ms etwa 0,5 bis 0,7 s) setzt das Spiel den Knopf auf **`disabled=true`** (Deckkraft 0,35, weiterhin `display:block`). **Der Klick wirkt also.**
    3. Am Kampfende wird SKIP ausgeblendet und dann entweder `#btn-continue-battle` („Continue...“) eingeblendet oder der Bildschirm direkt gewechselt.
  - **Dauer:**
    - Normale Kämpfe nach dem Skip: 1,0 bis 7,4 s.
    - Der Bosskampf gegen Erika (`n8_0`): **16,7 s**, obwohl SKIP schon nach 0,6 s gedrückt war.
  - **Ursache des Hängers (Bot, nicht Spiel):** Der Bot wertet „SKIP noch sichtbar“ als „Klick ohne Wirkung“. `isShown` prüft `disabled` nicht, und die Kampfsignatur hat keinen Fortschritt. Deshalb klickt er den **gesperrten** Knopf noch zweimal und pausiert nach etwa 15 s, kurz vor dem Kampfende.
  - **Folge für den Bot (P3a):**
    - Unterscheiden zwischen „sichtbar“ und „bedienbar“ (`disabled`, `aria-disabled`, `pointer-events`).
    - Ein Knopf, der nach dem Klick gesperrt wird, gilt als Wirkung.
    - Ein laufender Kampf mit gesperrtem SKIP heißt warten.
    - Kampffortschritt (KP-Texte) gehört in die Signatur.
    - Für echte Hänger sorgt ein Watchdog.
  - Die Rohdaten (`artifacts/live/battle-buttons.json`, gitignored) stammen aus dem Live-Test (`tests/e2e/live.spec.ts`, Beobachter nur lesend).
  - **Behoben in P3a (D-037):**
    - Der Bot klickt nur noch bedienbare Ziele, und ein nach dem Klick gesperrter Knopf gilt als Wirkung. Die Kampfsignatur enthält den KP-Fortschritt, dazu kommt ein Watchdog.
    - Live-Lauf vom 2026-11-26: 10 min ohne Hänger, bis zu 7 Orden.
    - Kampfdauern aus 78 Kämpfen: Median 3,0 s, 90 % unter 7,5 s, längster Kampf 33,4 s.

### 12.9 Manipulationsschutz `pk` (gelesen am 2026-11-25, Session 1, P2, nur lesend)
- Das Spiel hat ein globales Objekt `pk` mit einem Speicher-Digest. `pk.keyClass` ordnet localStorage-Schlüssel ein: In den Digest gehen **nur Schlüssel mit Präfix `poke_`**, ausgenommen eine feste Ausnahmeliste und Schlüssel auf `_seen`. `pkrl_*` und fremde Präfixe zählen nicht.
- `pk.active` war `false` (frisches, nicht eingeloggtes Profil). Die Zähler `pk.extCount` und `pk.decCount` standen auf 0.
- **Folge für den Bot (D-031, R-102):** Ein eigener Fallback-Speicher mit Präfix `pkbot.` liegt außerhalb des Digests und verändert ihn nicht. Spielschlüssel (`poke_*`, `pkrl_*`) bleiben tabu (R-145).
- **Live geprüft am 2026-11-26** (`scripts/recon/pk-tamper.mjs`, frisches Profil, ein Schlüssel `pkbot.recon`): `pk.keyClass` liefert `"client"` für `pkbot.recon` und `"server"` für `poke_current_run`. `extCount` und `decCount` bleiben vor dem Setzen, danach und nach einem Reload bei 0, `active` bleibt `false`. Das Präfix `pkbot.` ist also unbedenklich.
- **Offen (§13 Nr. 11):** Was zählen `extCount` und `decCount` sonst, etwa Erweiterungen oder Eingriffe im DOM? Bemerkt das Spiel Overlay oder Bridge? Bei jedem Live-Lauf vorher und nachher ablesen (P3, R-145).

## 13. Offene Fragen, gebündelt (Stand 2026-11-25, Ende Phase 1)
Diese Liste ersetzt §7, §10.5 und §10.7 als Arbeitsliste. Erledigtes ist dort markiert.

| # | Frage | Status | Wo gelöst |
|---|---|---|---|
| 1 | **Lange Bosskämpfe mit gesperrtem SKIP** (§12.8): Wie erkennt man „Kampf läuft noch“ (KP, Kampflog) gegenüber „Kampf vorbei“? Wie lange ist SKIP gesperrt, und hängt das an den Skip-Einstellungen? | **geklärt 2026-11-26** (§12.8): SKIP wird nach dem Klick `disabled`, der Kampf läuft bis zu 16,7 s weiter. Behebung im Bot in P3a | P3 (R-087, R-094, R-190) |
| 2 | Fixtures fehlen für `transition`, `win`, `stat-buff`, `endless-stage-complete`, das Kampfende bei Niederlage, Shop/Mart (`shop-modal`, Mart-Knoten) und echte Modals (Entwicklung, `usable-item`, `eevee-choice`, `reset-run-modal`) | offen | P3 (R-075, R-224: erst Fixture, dann Logik) |
| 3 | DE/EN-Paare gibt es nur für catch und starter. Weitere Bildschirme brauchen eine zweite Sprache | offen | P3 (R-212) |
| 4 | Was bewirkt jede Spieleinstellung genau (`autoSkipBattles` vs. `autoSkipAllBattles`, `misclickProtection`, `skipTraitFx`)? | offen | P3 (R-073, R-074) |
| 5 | Nuzlocke: Wie setzt das Spiel „ein Fang pro Zone“ und Permadeath um? | offen | P4 (R-062) |
| 6 | Ace-Regel (Wiki): Behält im Kanto-Story-Kampf nur das höchstlevelige Gegner-Mitglied sein Item? | offen | P4 (R-090) |
| 7 | Mart-Knoten (`doPokeMartNode`): Tausch von Items gegen Candy ohne Pokédollar? Live bestätigen | **im Code bestätigt (D-042)**, live offen (nur Endlos-Challenge) | P3/P4 (R-055, R-136) |
| 8 | Tower-Start: Kommt der Starter aus dem PC? Welche Regeln haben Normal und Hardcore? | offen | P4 (R-040) |
| 9 | Darstellung der Boss-Vorschau im DOM | offen | P4 (R-121) |
| 10 | Stapelregeln für Items und Relikte (laut Wiki „not established“) | offen | P4 (R-221) |
| 11 | Manipulationsschutz `pk` (§12.9): Was zählen `extCount` und `decCount`? Ändern sie sich durch Overlay oder Bridge? | teilweise: ein `pkbot.`-Schlüssel ändert nichts (2026-11-26); Overlay und Bridge offen | P3 (R-145) |
