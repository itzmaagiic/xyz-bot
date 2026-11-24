# Strategie (DecisionEngine)

Alle Entscheidungen sind reine Funktionen in `src/core/strategy/` und unit-getestet. Jede trägt eine Begründung, die
im Overlay und im Log steht. Die Spielmechanik, auf der das aufbaut, steht in `docs/GAME_RECON.md` §8.

## Kernidee: mit der Kampf-Engine des Spiels simulieren

Ein Kampf wird im Spiel sofort komplett berechnet (`runBattle`). Die Bridge ruft dieselbe Funktion mit tiefen Kopien auf,
sichert RNG-Seed und Instanz-Zähler vorher und stellt beide danach exakt wieder her. Live geprüft: `state`, Seed und
Zähler sind danach identisch. 280 Bosskämpfe dauern etwa 60 ms, 68 Routen × 8 Durchläufe etwa 0,7 s.

**Fairness:** Simuliert wird nur mit eigenen Seeds, also über die Verteilung möglicher Gegner und Kampfverläufe. Der Bot
sagt nie den echten nächsten Gegner oder Kampfausgang aus dem gesäten Zufall voraus.

| Simulation | Wofür |
|---|---|
| `simulatePaths` | **Route.** Jeder Pfad bis zum Boss wird Knoten für Knoten durchgespielt: Gegner werden so erzeugt wie im Spiel (Level-Formel, Artenpool, Trainergröße, Spezialtyp), HP und Ohnmachten übertragen sich, nach jedem Sieg gibt es +2 Level für Lebende, Fänge kommen aus dem echten Pool, das Pokécenter heilt, „?“ mit den echten Wahrscheinlichkeiten. Ergebnis: P(Pfad überleben **und** Boss schlagen) und danach die Chance gegen den **nächsten** Boss (Heilung plus 6 Level angenommen). |
| `simulateBoss` (Reihenfolgen) | **Boss-Vorbereitung.** Kandidaten-Reihenfolgen (jeder als Lead, nach Level, nach HP) × 40 Kämpfe. Die beste wird über Shift+Slot-Tausche hergestellt (jede Permutation ist so erreichbar, erschöpfend getestet). |
| `simulateCatch` | **Fang.** Für jedes Angebot und für „keins“ wird das Team gegen den aktuellen und den nächsten Boss simuliert. |
| `simulateNodes` | Schnelle Vorsortierung, wenn es mehr als 36 Routen gibt. |

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

| Stand | Ergebnis |
|---|---|
| erste Version (Typ-Parser-Bug, falsche Teamgrenze) | fast nur Solo-Starter, ≈ 0–0,3 Orden pro Run |
| + Bugfixes und Heuristiken | Ø 0,5–1,1 Orden, Brock oft Endstation |
| + Knoten- und Boss-Simulation | Brock in 8 von 11 Runs, Misty wird die Wand |
| **+ Pfadsimulation mit HP und Ohnmachten** | 10-Minuten-Lauf: **4 und 4 Orden** (bis einschließlich Erika). Gestorben wird jetzt auf Map 5 unterwegs, nicht mehr am Boss |

## Offene Hebel

1. Tode unterwegs auf Map 5 (Koga): Abnutzung über viele Kämpfe. Mehr Stichproben und stärkere Gewichtung des Pokécenters nötig.
2. Relic-/Passive-, Shop- und Entwicklungs-Dialoge sind live noch nicht gesehen. Der Bot pausiert dort.
3. Top-4-Gauntlet: Die Simulation deckt das aktuelle Mitglied ab. Die Folgekämpfe ohne Heilung sind noch nicht modelliert.
