# Aufklärung: Pokelike (https://pokelike.xyz)

Hier steht, was über das Spiel bekannt und belegt ist. Die vollständige Aufklärung ist **Phase 1** (`docs/PLAN.md`, R-036 und R-064 bis R-077).
**Kennzeichnung:**
- **[geprüft DATUM, vX]**: selbst im Spiel verifiziert, mit Datum und Spielversion.
- **[Spielstand]**: aus dem localStorage-Export des Nutzers abgeleitet (`tests/fixtures/storage/`, v3.8, 2026-11-25).
- **[ungeprüft]**: nur Seitentext, Community-Angabe oder Hauptauftrag.

Für Bot-Entscheidungen zählt nur, was geprüft ist. Bei einem Widerspruch gilt das beobachtete Spiel (R-064).

**Pflichtinhalt laut R-076:** Bildschirme, Erkennungsmerkmale, Selektoren, Datenquellen, CSP, Spielversion, offene Fragen.

---

## 1. Allgemein und Technik
- Titel „Pokelike: Pokemon Roguelike“. Das Hauptmenü zeigt „POKÉMON ROGUELIKE | v3.8“. **[geprüft 2026-11-25, v3.8]**
- Es ist eine Seite mit gebündeltem JavaScript (`/js/bundle.<hash>.js`, am 2026-11-25 `bundle.d97633119f.js`), dazu `fps-meter.js`, Google Analytics (gtag), Cloudflare Insights und ein Consent-Manager (CMP/TCF). Sie wird über Cloudflare ausgeliefert. **[geprüft 2026-11-25]**
- In headless Chromium lädt sie auf Desktop (1440×900) und in der iPhone-Emulation ohne JS-Fehler und ohne erkennbaren Bot-Schutz. **[geprüft 2026-11-25]**
- **CSP** (HTTP-Header): `object-src 'none'; base-uri 'self'; frame-ancestors 'self'`, dazu `X-Frame-Options: SAMEORIGIN`. Es gibt **kein `script-src`**. Inline-Skripte bzw. ein Seiten-Skript per script-Element sind deshalb voraussichtlich erlaubt (R-106). In Phase 1 ist das per Test zu bestätigen, und auf eine Meta-CSP ist zu prüfen. **[geprüft 2026-11-25, Header]**
- Ob das Spiel DOM oder Canvas nutzt und welches Framework: **offen (R-067)**. Die Bedienelemente sind als DOM-Buttons und Links auslesbar. Gefunden wurden „PLAY STORY“, „ENTER TOWER“, „TAKE CHALLENGE“, „Open menu“ und weitere. Das spricht für DOM. **[geprüft 2026-11-25, Hauptmenü]**
- Spielsprache: Der Nutzer spielt auf **Deutsch** (`poke_settings.language = "de"`). Die englischen Texte aus dem Hauptauftrag gelten also nicht zwingend, deshalb fordert R-212 eine sprachunabhängige Erkennung. **[Spielstand]**

## 2. Datenquellen (Vorab-Befund aus dem Spielstand, R-069)
Der Spielzustand liegt **als JSON im localStorage**. Die Schlüssel haben die Präfixe `poke_` (Spiel- und Kontodaten) und `pkrl_` (Cache von Pokémon-Daten). Laut Fair-Play-Regel (R-145) liest der Bot diesen Speicher **nur**, er schreibt ihn nie. **[Spielstand]**

| Schlüssel | Inhalt |
|---|---|
| `poke_current_run` | Der laufende Run (siehe unten) |
| `poke_parked_run:<modus>` | Geparkter Run je Modus, z. B. `endless2`, als `{run, endless}` (JSON-Strings) |
| `poke_settings` | Spieleinstellungen (siehe Abschnitt 4) |
| `pkrl_poke_<id\|name>` | Pokémon-Daten aus dem Cache: `id`, `name`, `types`, `baseStats{hp,atk,def,speed,special,spdef}`, `bst`, Sprite-URLs (PokeAPI). Laut Spielstand sind es 168 Einträge, inklusive Mega-Formen wie `pkrl_poke_gengar-mega`. |
| `pkrl_species_list` | Liste `{name, id}` aller Spezies |
| `poke_dex`, `poke_shiny_dex`, `poke_aurora_dex` | Pokédex-Fortschritt |
| `poke_hall_of_fame`, `poke_hof_index` | Hall of Fame. Der Bot **darf sie nicht verändern** (R-145). |
| `poke_challenge_stats`, `poke_challenges_done`, `poke_weekly*`, `poke_daily` | Challenge-, Wochen- und Tagesfortschritt |
| `poke_pokedollars`, `poke_stat_buffs`, `poke_ev_reset_total` | Geld und dauerhafte EV-Upgrades (Tower-Vitamine?) |
| `poke_pokechain`, `poke_pokechain_progress` | Daily Pokésort (vermutlich, intern „pokechain“) |
| `poke_save_token`, `poke_save_owner`, `poke_username`, `poke_soul_link_live` | **Zugangs- und Personendaten. Der Bot liest, loggt und exportiert sie nie (R-148).** Sie sind im Fixture entfernt. |

**`poke_current_run`** (Auszug der Felder): `currentMap`, `currentNode`, `currentNodeId`, `team[]`, `items[]`, `badges`, `map`, `eliteIndex`, `trainer`, `starterSpeciesId`, `maxTeamSize`, `nuzlockeMode`, `gen2Mode` bis `gen4Mode` (Region bzw. Generation), `silverBeaten`, `usedPokecenter`, `runSeed`, `rngSeed`, `challengeWeekly`, `mapStartSnap`, `savedCatch`, `itemOffer`, `itemsThisRun`, `_bossPrepDone`. Geparkte Endless- bzw. Tower-Runs haben zusätzlich `isEndlessMode`, `endlessStage`, `passives`, `runBuffs`, `runStats`, `startingItemId` und `challenge*`.
- **Team-Mitglied:** `_uid`, `speciesId`, `name`, `nickname`, `level`, `currentHp`, `maxHp`, `isShiny`, `types[]`, `baseStats{}`, `spriteUrl`, `megaStone`, `heldItem` (z. B. Mega-Stein mit `megaTypes` und `megaStats`) und `moveTier` (0 oder 1). **Attacken sind nicht direkt enthalten.** Woraus sich der Angriffstyp ergibt, ist offen (R-071).
- **Item:** `id`, `name`, `desc`, `icon` (z. B. `scope_lens`, „+30% crit chance“).
- **Karte** `map`: `nodes{id → {id, type, layer, col, visited, accessible, revealed, trainerSprite?, mapIndex?}}`, `edges[{from, to}]`, `layers[[…]]`, `mapIndex`. Gefundene Knotentypen: `start`, `battle`, `trainer`, `catch`, `question`, `item`, `pokecenter`, `boss` und `move_tutor`. Die aktuelle Position steht vermutlich in `currentNodeId`.
- **Tower bzw. Endless** (`endless`): `stageNumber`, `regionNumber`, `mapIndexInRegion`, `currentRegion`, `traitTiers`, `bigBossesCleared`, `wtTrainerPicks`, `wtGauntletPick`, `wtOuterTypes`.
- In Phase 1 ist zu klären: Ist localStorage während des Spiels immer aktuell, oder wird nur an bestimmten Punkten gespeichert? Gibt es zusätzlich einen globalen JS-Zustand? Wie verhalten sich Cloud-Sync (`poke_last_cloud_sync`) und `poke_progress_backup`?

## 3. Hauptmenü **[geprüft 2026-11-25, v3.8]**
- Die Modi heißen **Story** („PLAY STORY“), **Battle Tower** („ENTER TOWER“), **Challenges** („TAKE CHALLENGE“, im frischen Browser ausgegraut bzw. gesperrt), **Multiplayer** („COMING SOON“) und **Daily Pokésort** (₽500, neues Rätsel täglich).
- In der oberen Leiste stehen Geld (₽), Pokédex, PC, Einstellungen, Vollbild und Poké Mart. Auf dem Desktop kommen Achievements und Mega Bracelet hinzu. Auf dem iPhone liegt die Navigation hinter einem Hamburger-Menü („Open menu“).
- Die Desktop-Navigation umfasst HOME, POKÉDEX, ITEMS, ACHIEVEMENTS, HALL OF FAME, PC, LOGIN / SIGNUP, PATCH NOTES, SETTINGS, CREDITS und DISCORD.
- Die Screenshots entstanden headless mit frischem Profil, also ohne Spielstand und mit englischer UI.

## 4. Spieleinstellungen (`poke_settings`) **[Spielstand]**
`autoSkipBattles`, `autoSkipAllBattles`, `autoSkipEvolve`, `skipResetConfirm`, `darkMode`, `hideBossPreview`, `showShortcuts`, `language`, `musicEnabled`, `musicVolume`, `sfxEnabled`, `sfxVolume`, `skipTraitFx`.
Für die Geschwindigkeit sind vermutlich `autoSkipBattles`, `autoSkipAllBattles`, `autoSkipEvolve` und `skipTraitFx` nützlich. Ändern darf der Bot sie nur nach Bestätigung durch den Nutzer und nur über die Spieloberfläche (R-074, R-145). Für die Vorausschau ist `hideBossPreview = false` wichtig (R-121).

## 5. Bildschirme in einem Run **[ungeprüft]** (Seitentext und Hauptauftrag, Bezeichnungen wörtlich)
- Start: „Who are you?“ (BOY / GIRL), danach „Choose Your Starter!“
- Wildes Pokémon: „Wild Battle!“ bzw. „Wild Pokemon Appeared!“ mit „Skip“, „Continue“ und „Skip (flee)“
- Item: „Item Found! Choose one item to keep“ mit „Skip“
- Relikt: „Pick one — it stays in your bag for the rest of the run.“
- Team voll: „Team Full!“ mit „Keep team as-is“
- Tausch: „Trade Offer“ mit „Decline“
- Orden: „Badge Earned!“ mit „Next Map →“
- Kampf-Vorbereitung: „Choose Your Order“, Drag & Drop, „hover for stats“, danach „FIGHT!“
- Kampf-Panels: „Your Team“, „Enemy“ bzw. „Opponent“ und „Bag“. Run-Tabs: TEAM, ITEMS, RELICS, BADGES, GOALS.
- Ende: „GAME OVER“ (Play Again / Main Menu) oder „YOU ARE THE CHAMPION!“ (Play Again / Share / Climb the Tower / Home)
- Außerdem: Entwicklungen, Shop/Pokémart, Resume-Buttons, Move-Tutor (Knotentyp `move_tutor` laut Spielstand)
- Obere Leiste im Run: Menu, Reset Run (**darf der Bot nie klicken, R-147**), Pokédex, Achievements, Map, PC, Settings, Fullscreen, Poké Mart

## 6. Mechaniken laut Hauptauftrag und Community **[ungeprüft]**
- Autobattler: Die Kämpfe laufen automatisch, entscheidend ist die Vorbereitung.
- Das erste lebende Pokémon im Team kämpft zuerst.
- Gehaltene Items können Angriffstyp und Wirkung verändern.
- Traits: 2 Punkte pro Stufe. Normale Pokémon geben 1 Punkt pro Typ, Shinys 2.
- Level und Sonderbonbons beleben besiegte Pokémon nicht wieder.
- Nuzlocke: ein Fang pro Zone, Besiegte sind für immer weg.
- Battle Tower: dauerhafte EV-Upgrades (Vitamine) für Pokédollar.
- Quellen zum Auswerten (R-064): pokelike.wiki (`/battle-tower/`, `/guides/kanto/`, `/traits/`, `/items/`) und pokelike-guide.fr.

## 7. Offene Fragen (Phase 1)
1. DOM oder Canvas, und welches Framework? Gibt es einen globalen Zustand im `window`?
2. Wann schreibt das Spiel `poke_current_run`? Nach jeder Aktion oder nur an Speicherpunkten?
3. Woraus ergeben sich Attacken und Angriffstypen eines Pokémon (`moveTier`, Typen, Items)?
4. Wie sehen alle Bildschirme in deutscher und englischer Spielsprache aus? Welche Erkennungsmerkmale sind sprachunabhängig?
5. Wie funktionieren Drag & Drop bei „Choose Your Order“ (Pointer- oder Touch-Events, HTML5-DnD)?
6. Wie zeigt das Spiel den nächsten Boss an (Boss-Vorschau)?
7. Erlaubt die CSP ein Seiten-Skript per script-Element? Gibt es zusätzlich eine Meta-CSP?
8. Wie lassen sich WebKit-Abhängigkeiten in der Cloud installieren (D-011)?
