# Strategie (DecisionEngine)

Alle Entscheidungen sind reine Funktionen in `src/core/strategy/` und unit-getestet. Jede Entscheidung trägt eine
Begründung, die im Overlay und im Log steht.

## Bewertung eines Pokémon (`evaluate.ts`)

- Werte aus Basiswerten und Level (Gen-3-Formel, IV 31, EV 0). DOM-Karten zeigen bereits Ist-Werte und werden als
  `actualStats` direkt verwendet.
- Angriff = Angriffs- bzw. Spezialwert × Stärke der besten Attacke (vom Spiel selbst über `getBestMove`) × STAB 1,5.
- Typvorteile werden **gedämpft** (Wurzel). Im Live-Test hat ein Lv-4-Konter sonst einen Lv-11-Starter verdrängt und verloren.
- Score = √(Angriff × Haltbarkeit) × (1 + Init/250), Shinys × 1,1 (2 Trait-Punkte).

## Route (`map.ts`)

Alle Pfade von den erreichbaren Knoten bis zum Boss werden aufgezählt (max. 5000). Gewählt wird der erste Schritt des
Pfads mit der höchsten Summe. Unterwegs wird mitgerechnet:

| Knoten                                                                             | Wert                                                                                        |
| ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Fang                                                                               | 6 + 9·(1 − Teamgröße/6), ab 3 Mitgliedern geteilt durch √(1 + XP-Bedarf), solange Platz ist |
| Kampf / Trainer                                                                    | 3 bzw. 4 × (1 + XP-Bedarf); bei < 45 % HP 1 bzw. 0 (Nuzlocke negativ)                       |
| Pokécenter                                                                         | 9 bei < 60 % HP, 3 bei < 85 %, sonst 0,5                                                    |
| Item 5 · Move-Tutor 4,5 · Event 3,5 · Shiny 7 · Legendär 8 · Tausch 1,5 · Mart 2,5 |

- **Projektion:** Fänge erhöhen die Teamgröße, Kämpfe kosten HP (8 % bzw. 14 %), das Pokécenter füllt auf.
- **XP-Bedarf** (0…2) = (erwartetes Boss-Level − Ø-Level der stärksten drei) / 4, mit Boss-Level ≈ 12 + 6 · Orden (Hinweiswert).
- **Teamgrenze = 6.** `state.maxTeamSize` ist die bisher erreichte Größe und nicht die Grenze. Diese Verwechslung hat den Bot
  anfangs fast nie fangen lassen.

## Einzelentscheidungen (`choices.ts`)

- **Starter:** Lieblings-ID aus den Einstellungen, sonst bester Schnitt gegen die ersten zwei Arenatypen der Region
  (Kanto: Gestein/Wasser ⇒ Bisasam).
- **Fang:** bestes Angebot. Bei vollem Team nur, wenn es das schwächste Mitglied um mindestens 10 % übertrifft.
- **Team voll:** das schwächste Mitglied freilassen. Ist der Neuzugang schwächer, wird das Team behalten.
- **Items:** feste Werte (Life Orb > Expert Belt > Choice Band/Specs > Leftovers …). Typ-Booster zählen nach der Zahl der
  passenden Attacken im Team, Unbekanntes ist neutral (3). Halter ist der stärkste Angreifer.
- **Move-Tutor:** der stärkste Angreifer lernt.
- **Reihenfolge:** Wer zuerst lebt, kämpft zuerst. Auf der Karte führt das insgesamt stärkste Pokémon. Vor Bossen
  (`elite-prep-screen`) führt der beste Konter gegen den Boss-Typ. Getauscht wird nur bei mindestens 15 % Vorteil, über das
  Tastenkürzel des Spiels (Shift+Ziffer ⇒ `swapPartyLeadWith`). Drag & Drop geht mit synthetischen Events nicht, weil das
  Spiel `setPointerCapture` aufruft.
- **Shiny:** nehmen (abschaltbar). **Tausch:** ablehnen (Mystery-Tausch ist ein Risiko).
- **Unbekannter Screen oder Dialog, Relic/Passive, Tower-Buffs:** Pause mit Hinweis, niemals raten.

## Messwerte (Live, Kanto Classic, bereinigter echter Spielstand, je 6 Minuten)

| Stand                                                 | Orden pro Run                                           |
| ----------------------------------------------------- | ------------------------------------------------------- |
| erste Version (Typ-Parser-Bug, Teamgrenze falsch)     | ≈ 0,1–0,3, fast nur Solo-Starter                        |
| + Typ-Parser, Starterwahl, Teamgrenze 6               | 6 von 9 Runs schlagen Brock, Ende meist bei Misty       |
| + XP-Bedarf (auch bei Mini-Team)                      | 7 Runs: Ø 1,1, bester Run 3 Orden (Brock, Misty, Surge) |
| **aktueller Build** (+ Fang-Vorrang bis 3 Mitglieder) | 10 Runs: [0,0,2,0,1,1,1,0,0,0] ⇒ Ø 0,5                  |

Die Stichproben sind klein (7–10 Runs), der Unterschied der letzten beiden Zeilen ist **nicht belastbar**. Konstant zeigt
sich: Runs, die Brock mit Führungs-Level 6–9 erreichen, verlieren. Das Balancing XP ↔ Teamgröße ist der wichtigste
offene Punkt. Zum Tunen eignet sich `npm run e2e:live` mit `LIVE_MINUTES=20+` (Auswertung in `test-results/live-run.*`).

## Nächste Hebel

1. Frühe Trainerkämpfe mit kleinem, niedrigem Team meiden (Risiko pro Kampf gegen HP und Level bewerten).
2. Echte Boss-Teams aus dem Spiel lesen (Boss-Vorschau) statt der Typ-Hinweistabelle.
3. Relic/Passive-, Shop-, Entwicklungs- und Tower-Screens automatisieren, sobald sie live erfasst sind.
4. Nuzlocke-spezifisch: ein Fang pro Zone, Kämpfe mit Ohnmachtsrisiko stärker bestrafen.
