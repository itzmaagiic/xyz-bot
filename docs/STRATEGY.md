# Strategie (DecisionEngine)

Alle Entscheidungen sind reine Funktionen in `src/core/strategy/` und unit-getestet. Jede trägt eine Begründung, die
im Overlay und im Log steht. Die Spielmechanik, auf der das aufbaut, steht in `docs/GAME_RECON.md` §8.

## Kernidee: mit der Kampf-Engine des Spiels simulieren

Ein Kampf wird im Spiel sofort komplett berechnet (`runBattle`). Die Bridge ruft dieselbe Funktion mit tiefen Kopien auf,
sichert RNG-Seed und Instanz-Zähler vorher und stellt beide danach exakt wieder her. Live geprüft: `state`, Seed und
Zähler sind danach identisch. 280 Bosskämpfe dauern etwa 60 ms, 68 Routen × 8 Durchläufe etwa 0,7 s.

**Fairness:** Simuliert wird nur mit eigenen Seeds, also über die Verteilung möglicher Gegner und Kampfverläufe. Der Bot
sagt nie den echten nächsten Gegner oder Kampfausgang aus dem gesäten Zufall voraus.
Seit 2026-11-25 (D-025, R-248) kommt die Seed-Basis aus einem FNV-1a-Hash des **sichtbaren** Zustands, also Karte, Knoten
und Team mit Art, Level und KP (`src/core/bridge/sim-seed.ts`), und nicht mehr aus `getRngSeed()`. Davor war sie daraus abgeleitet.
`getRngSeed()` dient nur noch zum Sichern und Wiederherstellen. Gleicher sichtbarer Zustand bedeutet gleiche Simulation und damit gleiche Entscheidung (R-030).

| Simulation                    | Wofür                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `simulatePaths`               | **Route.** Jeder Pfad bis zum Boss wird Knoten für Knoten durchgespielt: Gegner werden so erzeugt wie im Spiel (Level-Formel, Artenpool, Trainergröße, Spezialtyp), HP und Ohnmachten übertragen sich, nach jedem Sieg gibt es +2 Level für Lebende, Fänge kommen aus dem echten Pool, das Pokécenter heilt, „?“ mit den echten Wahrscheinlichkeiten. Ergebnis: P(Pfad überleben **und** Boss schlagen) und danach die Chance gegen den **nächsten** Boss (Heilung plus 6 Level angenommen). |
| `simulateBoss` (Reihenfolgen) | **Boss-Vorbereitung.** Kandidaten-Reihenfolgen (jeder als Lead, nach Level, nach HP) × 40 Kämpfe. Die beste wird über Shift+Slot-Tausche hergestellt (jede Permutation ist so erreichbar, erschöpfend getestet).                                                                                                                                                                                                                                                                             |
| `simulateCatch`               | **Fang.** Für jedes Angebot und für „keins“ wird das Team gegen den aktuellen und den nächsten Boss simuliert.                                                                                                                                                                                                                                                                                                                                                                               |
| `simulateNodes`               | Schnelle Vorsortierung, wenn es mehr als 36 Routen gibt.                                                                                                                                                                                                                                                                                                                                                                                                                                     |

Bewertung einer Route: `P·100 + 60·P·P(nächster Boss) + Boni (Item 4, Move-Tutor 5, Shiny 6, „?“ 2) + 0,5·Ø-Level`.

## Items (echte IDs aus `ITEM_POOL` / `USABLE_ITEM_POOL`)

- **Auswahl:** Rare Candy 8, TM 8 (nur solange jemand unter Stufe 2 ist), Expert Belt 7,5, Choice Band 7, Wide Lens 6,5,
  Leftovers 6,5, Choice Specs 6,5 … Sacred Ash 9, wenn jemand besiegt ist, sonst 6. Typ-Booster zählen nach den Attacken im Team.
- **Beutel:** Verbrauchsitems landen im Beutel. Candy, TM und Mondstein setzt der Bot sofort ein, Sacred Ash erst, wenn
  jemand besiegt oder unter 35 % ist. Das Spiel öffnet den Beutel nur per Pointer-Geste mit `setPointerCapture`, die synthetische
  Events nicht erfüllen. Die Bridge ruft deshalb `openUsableItemModal`/`openItemEquipModal` auf (wie ein Tipp aufs Symbol), die
  Auswahl klickt der Bot im Dialog. Ziele sind nur Zeilen, die das Spiel freigibt (`data-shortcut`).
- **Halter:** Choice Band → stärkster physischer, Choice Specs → stärkster spezieller Angreifer, Typ-Booster → passende
  Attacke, Leftovers/Assault Vest/Red Card/Rocky Helmet/Shell Bell → haltbarstes Mitglied, Lucky Egg → niedrigstes Level.
  Bevorzugt werden Mitglieder ohne Item. `data-unequip` wird nie geklickt.

## Weitere Entscheidungen

- **Starter:** bester Schnitt gegen die ersten zwei Arenatypen (Kanto ⇒ Bisasam).
- **Team voll:** das schwächste Mitglied freilassen, außer der Neuzugang ist schwächer.
- **Reihenfolge auf der Karte:** das stärkste lebende Pokémon führt. Besiegte bekommen keine XP und kämpfen nicht.
- **Ohne Bridge (DOM-Fallback):** die Heuristiken (`map.ts`, `choices.ts`) als Rückfallebene.

## Messwerte (Live, Kanto Classic, bereinigter echter Spielstand)

| Stand                                                                                         | Ergebnis                                                                                                                                                                                                         |
| --------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| erste Version (Typ-Parser-Bug, falsche Teamgrenze)                                            | fast nur Solo-Starter, ≈ 0–0,3 Orden pro Run                                                                                                                                                                     |
| + Bugfixes und Heuristiken                                                                    | Ø 0,5–1,1 Orden, Brock oft Endstation                                                                                                                                                                            |
| + Knoten- und Boss-Simulation                                                                 | Brock in 8 von 11 Runs, Misty wird die Wand                                                                                                                                                                      |
| + Pfadsimulation mit HP und Ohnmachten                                                        | Läufe mit 4, 4, 5, 7 und 8 Orden                                                                                                                                                                                 |
| **Variante A** (Pfadsimulation, Level-Gewichtung 2,5, Gauntlet, Beutel, Fänge per Simulation) | 12 Runs Ø **3,2 Orden**: [2,3,5,8,3,1,5,1,5,3,1,1]; der 8-Orden-Run schlug Lorelei, Bruno, Agatha und Lance und gewann den fünften Kampf gegen Gary (+2 Level danach, kein Game Over) → **erster Champion-Sieg** |

### Erster bestätigter Champion-Sieg

Variante H (Commit `07f98ec`: Pfadsimulation mit Zwei-Map-Horizont und Ketten-Fortschritt), Run 13 einer Session,
Sieg im dauerhaften Zähler des Overlays („13 · 1 Sieg · 12 Niederlagen“) und Sieg-Bildschirm erkannt.

- Map 9: Legendäres **Lavados** unterwegs gewonnen und ins Team geholt, Pokécenter direkt vor den Top 4.
- Vor **jedem** Top-4-Kampf hat die Reihenfolge-Simulation umgestellt: 8 % → 57 %, 53 % → 75 % → 85 %, 68 % → 95 %,
  vor Gary 100 %.
- Siegerteam: Kingler 76, Lavados 74, Digdri 73, Aerodactyl 72, Amoroso 70, Blitza 65.

## A/B-Tests (je etwa 30 Minuten, parallel)

| Variante                                               | Runs | Ø Orden |
| ------------------------------------------------------ | ---- | ------- |
| A (Standard)                                           | 12   | **3,2** |
| B: Level-Gewichtung 0,5                                | 10   | 2,1     |
| C: + gemeinsame Reihenfolgensuche, Top-3-Level, Tausch | 10   | 1,8     |
| D: C + multiplikative Bewertung                        | 8    | 2,5     |
| E: multiplikativ ohne C-Neuerungen                     | 10   | 2,5     |

Die Varianten C–E stecken hinter Flags (`src/core/flags.ts`, Build mit `PKBOT_FLAGS='{"…":true}'`) und sind aus.
Die Stichproben sind klein; die Rangfolge A > {B…E} war aber über die ganze Laufzeit stabil.

## Was einen Run killt (Auswertung aller Live-Tode)

- **Die meisten Tode passieren unterwegs, fast immer bei Trainern** (2–3 Pokémon auf Trainerlevel bei gleicher XP wie
  ein Wildkampf). Am Boss wird seltener verloren.
- Oft hatte die Simulation dort schon 0 % gezeigt: Das Team war durch Abnutzung (Besiegte bleiben bis zum Pokécenter K.o.)
  oder fehlende Level schon in einer aussichtslosen Lage.
- Die Gesamtchance ist ein Produkt über 9 Maps (0,95⁹ ≈ 63 %). Zuverlässigkeit braucht ≥ 99 % pro Map.
- Vor jedem Top-4-Mitglied erscheint die Boss-Vorbereitung; die Reihenfolge-Simulation hob die Kettenchance dort
  z. B. von 3 % auf 65–78 %.

## Challenge-Modus (Fokus seit D-040)

### Baseline Arena-Challenge (2026-11-27, 30 min live, bereinigter Spielstand, `artifacts/chal1`)
- **Übernommener Run aus dem Spielstand:** Niederlage gegen Pryce (Karte 6, 6 Orden).
- **Neuer Run mit dem stärksten PC-Starter** (Mega-Mewtu Y, shiny, 50 Buff-Punkte): Alle 8 Arenaleiter wurden mit simulierten 100 % geschlagen, danach kam die **Niederlage gegen „Unova League +4“** (Top 4 und Champ am Stück). Team Lv 87–98, die Simulation sagte dort von Anfang an 0 %, und schon auf Karte 8 nur „~31 %“.
- **Dritter Run:** Abbruch durch einen Bot-Fehler. Beim Attacken-Lehrer kennen alle die Attacke schon, der Bot hielt den Dialog für einen Item-Dialog. Behoben.
- **Ursache der Liga-Niederlage:** Solange alle Bosse ~100 % zeigen, gibt die Simulation beim Fangen kein Signal. Gefangen wurden deshalb schwache Arten (Nuzleaf, Swadloon, Shellos, Maractus). Die Liga ist erst im letzten Gebiet vorausberechenbar (`endlessState.currentRegion.trainers` umfasst nur das aktuelle Gebiet), dann ist es zu spät.

### Änderung 1 (2026-11-27)
- Bei Gleichstand der Simulation (gesättigt) entscheidet die Summe der Basiswerte.
- Mit vollem Team wird nur eine deutlich stärkere Art gefangen (≥ 15 % über dem schwächsten Mitglied), die das schwächste ersetzt.
- Messung: `artifacts/chal2` brach am Bildschirm „Neues Pokémon!“ ab (Bot-Fehler, behoben). Gültig ist `artifacts/chal3` (30 min live, 2026-11-27).

### Messung nach Änderung 1 (`artifacts/chal3`)
| | Baseline (`chal1`) | Änderung 1 (`chal3`) |
|---|---|---|
| Neue Runs bis zum Ende | 1 | 5 |
| Siege | 0 | 0 |
| Bis zur Liga (Etappe 9) gekommen | 1 von 1 | 5 von 5 |
| Ende | Niederlage „Unova League +4“ | 5× Niederlage in der Liga (Sinnoh, Hoenn 2×, Kanto, Unova) |
| Team in der Liga | Lv 87–98, schwache Arten (Shiftry, Leavanny, Gastrodon …) | Lv 85–109, viele Legendäre (Latios, Articuno, Celebi, Deoxys, Kyurem, Azelf, Moltres …) |

- Der übernommene Run aus dem Spielstand verlor wie in der Baseline gegen Pryce. Er zählt nicht, weil sein Team nicht vom Bot stammt.
- **Änderung 1 wirkt bei den Fängen:** Die Teams bestehen jetzt aus deutlich stärkeren Arten. Am Ergebnis ändert das nichts, denn die 8 Arenen schafft der Bot ohnehin, und an der Liga scheitert er weiter.
- **Die Liga ist der Engpass.** Auf der letzten Karte sagte die Simulation jedes Mal 0 % (einmal 11 % bzw. 19 %). Auf den Karten davor schätzte die Vorschau „dann Liga ~60–93 %“. Diese Vorschau ist viel zu optimistisch, deshalb bereitet sich der Bot nicht vor.
- „League +4“ ist eine Kette aus 5 Trainern (Top 4 und Champion) ohne Heilung. Vor jedem Kampf gibt es einen Vorbereitungs-Bildschirm. Die Gegner werden der Reihe nach stärker (Stufe des Champions minus 6 pro Platz davor).
- **Die Runs kamen weiter als gedacht:** Jeder neue Run schlug 3 bis 4 der 5 Liga-Gegner.
- **Gefundener Fehler:** Nur das erste Mitglied kämpfte, die anderen standen mit vollen KP daneben. Mewtu ging mit 11 % KP in den Champion-Kampf. Grund: Die Simulation spielte vor jedem Liga-Kampf wieder alle 5 Gegner durch, ergab so immer 0 %, und der Bot stellte nie um. Details in D-043.

### Änderung 2 (2026-11-27, D-043)
- Die Liga-Simulation beginnt beim aktuellen Gegner (`state._erGauntlet.idx`).
- Die Reihenfolge vor jedem Liga-Kampf richtet sich nach Siegchance + 0,25 × Fortschritt. Ist kein Gesamtsieg in Sicht, entscheidet also, wie weit das Team kommt.
- Die Vorschau heißt jetzt „~N % of the fights“, denn sie war nie eine Siegchance.
- Messung `artifacts/chal4` (30 min live):
  - Übernommener Run aus dem Spielstand: wieder Niederlage gegen Pryce (zählt nicht). Diesmal hat der Bot vorher umgestellt, simulierte Chance 0 % → 45 %.
  - **Erster neuer Run: Sieg.** Erster Challenge-Sieg des Bots, Stufe 3. Das Team aus Legendären (Rayquaza, Dialga, Arceus, Shaymin, Victini) kam über viele Legendären-Knoten zusammen, die Liga lag in der Simulation bei 98–100 %.
  - **Danach wählte das Spiel automatisch Stufe 4** (nächste Ordensstufe). Die 5 weiteren Runs sind deshalb nicht mit `chal3` vergleichbar: 2× Niederlage in der Liga, 2× gegen den 7. Arenaleiter, 1× gegen den 4.
  - Folge für Messungen: Der Live-Test kann die Stufe jetzt festlegen (`LIVE_LEVEL`, z. B. `2` = Stufe 3).

### Änderung 3 (2026-11-27, D-044)
- Die Liga steht ab dem Start des Runs fest (`endlessState.wtGauntletPick`) und ist mit Lv 106–140 viel stärker als jede Arena.
- Fang- und Relikt-Simulation bewerten deshalb zusätzlich, welchen Anteil der Liga-Kämpfe das Team gewinnen würde. Das Team wird dafür auf das typische Ankunftslevel projiziert (Arena 8 minus 6).
- Gewicht 0,25: Bei Arena-Risiko zählt die Arena, sind die Arenen sicher, entscheidet die Liga.
- Messung: `artifacts/chal5` mit fester Stufe 3 (`LIVE_LEVEL=2`), läuft.

## Run-Logs lesen (P3b, D-005, D-038)

- **Woher:**
  - Overlay → „Runs exportieren“ (Datei `pkbot-runs-<Datum>.json`, Format `pkbot-runs/1`).
  - Übernahme ins Repo mit `npm run runs:import -- <datei>` nach `runs/<YYYY-MM-DD>-<HHMMSS>-<rand4>/`.
  - Der Live-Test exportiert selbst nach `PKBOT_OUT/runs-export.json`, mit `LIVE_SAVE_RUNS=1` direkt nach `runs/`.
- **`decisions.jsonl`:** eine Zeile je ausgeführter Entscheidung (Wartezyklen nicht). Die Felder:
  - `state`: Team mit KP und Typen, Items, Beutel, Orden, Karte, Knoten samt Typ, `eliteIndex`, nächster Boss
  - `options`, `scores`: alle bewerteten Optionen mit Score und Faktoren, etwa `boss`, `survive`, `next` bei Routen
  - `chosen`, `reason`, `confidence`: die simulierte Erfolgsquote, falls vorhanden
  - `outcome`: `ok` oder `no-effect` beim Klick, `win` oder `loss` beim Run-Ende
- **`summary.json`:**
  - `result`: `win`, `loss`, `open` oder `aborted`; `progress`
  - `cause`: bei einer Niederlage der letzte Kampf mit Knotentyp, Karte, Boss und Team, beim Abbruch die Pause mit Art
  - `screenTimes`: Verweildauer je Bildschirm, also die Kampfdauern für die Budgets im Live-Test
  - `errors`: aus beiden Welten
  - `optionCoverage`: der Anteil der Entscheidungen mit Optionen. In P3b sind das Karte, Fang, Item und Starter, der Rest folgt mit R-116 in P4.
- **A/B-Vergleiche:** `profile.flags` und `bot_version` je Run zeigen, mit welcher Konfiguration gespielt wurde.

## Offene Hebel

1. Abnutzung früher erkennen: Pokécenter und Sacred Ash gezielter, Trainer meiden, wenn die Mannschaft angeschlagen ist.
2. Fänge auf Kurs halten: späte Fänge kommen auf Map-Level und ersetzen abgehängte Mitglieder.
3. Mehr Stichproben auf der Endmap (die Kettenwahrscheinlichkeit ist dort klein und verrauscht).
4. Challenges/Battle Tower: Traits, Augments und Relics (`buildTraitsConfig` speist die Kampf-Engine, die Simulation lässt
   sich dort weiterverwenden).
