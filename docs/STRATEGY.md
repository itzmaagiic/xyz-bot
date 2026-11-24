# Strategie (DecisionEngine)

Alle Entscheidungen sind reine Funktionen in `src/core/strategy/` und unit-getestet. Jede trägt eine Begründung, die
im Overlay und im Log steht. Die Spielmechanik, auf der das aufbaut, steht in `docs/GAME_RECON.md` §8.

## Kernidee: mit der Kampf-Engine des Spiels simulieren

Ein Kampf wird im Spiel sofort komplett berechnet (`runBattle`). Die Bridge ruft dieselbe Funktion mit tiefen Kopien auf,
sichert RNG-Seed und Instanz-Zähler vorher und stellt beide danach exakt wieder her. Live geprüft: `state`, Seed und
Zähler sind danach identisch. 280 Bosskämpfe dauern etwa 60 ms, 68 Routen × 8 Durchläufe etwa 0,7 s.

**Fairness:** Simuliert wird nur mit eigenen Seeds, also über die Verteilung möglicher Gegner und Kampfverläufe. Der Bot
sagt nie den echten nächsten Gegner oder Kampfausgang aus dem gesäten Zufall voraus.

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

Variante H (Commit `1ac0cec`: Pfadsimulation mit Zwei-Map-Horizont und Ketten-Fortschritt), Run 13 einer Session,
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

## Offene Hebel

1. Abnutzung früher erkennen: Pokécenter und Sacred Ash gezielter, Trainer meiden, wenn die Mannschaft angeschlagen ist.
2. Fänge auf Kurs halten: späte Fänge kommen auf Map-Level und ersetzen abgehängte Mitglieder.
3. Mehr Stichproben auf der Endmap (die Kettenwahrscheinlichkeit ist dort klein und verrauscht).
4. Challenges/Battle Tower: Traits, Augments und Relics (`buildTraitsConfig` speist die Kampf-Engine, die Simulation lässt
   sich dort weiterverwenden).
