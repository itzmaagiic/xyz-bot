# Spielwissen: Pokelike (https://pokelike.xyz)

Kennzeichnung: **[geprüft DATUM]** heißt selbst im Browser verifiziert. **[ungeprüft]** heißt nur aus dem Seitentext oder Hörensagen. Unbelegtes Wissen ist für Bot-Entscheidungen nicht verlässlich.
Diese Datei wächst in Phase 2. Jeder Spielbildschirm bekommt dann Erkennungsmerkmale, Selektoren und mögliche Aktionen.

## Allgemein
- Fan-Roguelike mit Pokémon-Thema, im Browser spielbar. Titel „Pokelike: Pokemon Roguelike“, Hauptmenü zeigt „POKÉMON ROGUELIKE | v3.8“. **[geprüft 2026-11-25]**
- Technik: eine Seite mit gebündeltem JavaScript (`/js/bundle.<hash>.js`), dazu `fps-meter.js`, Google Analytics und Cloudflare Insights. Lädt in headless Chromium auf Desktop (1440×900) und iPhone-Emulation ohne JS-Fehler und ohne erkennbaren Bot-Schutz. **[geprüft 2026-11-25]**
- Es gibt den Button „Get the app“ (installierbare Web-App?) und Login/Signup. **[ungeprüft]**

## Hauptmenü **[geprüft 2026-11-25]**
- Modi: **Story** („PLAY STORY“), **Battle Tower** („ENTER TOWER“), **Challenges** („TAKE CHALLENGE“, im Startzustand ausgegraut oder gesperrt), **Multiplayer** („COMING SOON“), **Daily Pokésort** (Belohnung ₽500, neues Rätsel täglich).
- Obere Leiste: Geld (₽), Pokédex, PC, Einstellungen, Vollbild, Poké Mart. Auf dem Desktop kommen Achievements und Mega Bracelet hinzu. Auf dem iPhone sitzt die Navigation im Hamburger-Menü („Open menu“).
- Desktop-Navigation: HOME, POKÉDEX, ITEMS, ACHIEVEMENTS, HALL OF FAME, PC, LOGIN / SIGNUP, PATCH NOTES, SETTINGS, CREDITS, DISCORD.

## Modi (laut Seitentext) **[ungeprüft]**
- **Story:** Regionen wie in den Hauptspielen, Arenen besiegen, Top Vier bezwingen. Varianten Classic oder Nuzlocke, danach Wahl der Region.
- **Battle Tower:** „staged maps across five regions“. Der Starter kommt aus bereits gefangenen Pokémon, Typ-Traits werden im Kampf aufgebaut, am Ende stehen regionale Bosse. Schwierigkeit Normal oder Hardcore.
- **Challenges:** keine Details. **Daily Pokésort:** 6 Pokémon so ordnen, dass jede Verbindung passt, eine Lösung pro Tag.

## Bildschirme in einem Run (laut Seitentext, Bezeichnungen wörtlich) **[ungeprüft]**
- Start: „Who are you?“ (BOY / GIRL) → „Choose Your Starter!“
- Wildes Pokémon: „Wild Battle!“ / „Wild Pokemon Appeared!“ mit „Skip“, „Continue“ und „Skip (flee)“.
- Item-Belohnung: „Item Found! Choose one item to keep“ mit „Skip“.
- Relikt: „Pick one — it stays in your bag for the rest of the run.“
- Team voll: „Team Full!“ mit „Keep team as-is“.
- Tauschangebot mit „Decline“.
- Orden: „Badge Earned!“ mit „Next Map →“.
- Kampf-Vorbereitung: „Choose Your Order“. Pokémon werden per Drag & Drop umsortiert, „hover for stats“, dann „FIGHT!“.
- Kampf-Panels: „Your Team“, „Enemy“/„Opponent“, „Bag“. Run-Tabs: TEAM, ITEMS, RELICS, BADGES, GOALS.
- Ende: „GAME OVER“ (Play Again / Main Menu) oder „YOU ARE THE CHAMPION!“ (Play Again / Share / Climb the Tower / Home).
- Obere Leiste im Run: Menu, Reset Run, Pokédex, Achievements, Map, PC, Settings, Fullscreen, Poké Mart.

## Regeln und Strategie
_Offen (Phase 2): Kampfsystem, Typen-Effektivität, Fangen, Items, Relikte, Map-Struktur, Heilung, Bosse, Unterschiede bei Nuzlocke und Hardcore. Gute und schlechte Entscheidungen aus Spielersicht sammeln. Diese Grundlage braucht der strategy-reviewer._
