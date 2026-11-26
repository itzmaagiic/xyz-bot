#!/usr/bin/env bash
# R-232: Prüft für jede Phase P0–P7, dass die Ausgabe des SessionStart-Hooks unter 9.000 Zeichen bleibt und dabei
# vollständig zeigt: jede offene R-ID (❌/🟡), „Nächster Schritt“ aus PROGRESS und – wenn die Phase offene Punkte
# hat – die Kurzform „Aktuelle Phase Pn im Detail“. Geprüft wird mit 400 Bytes Reserve für die Git- und
# Branch-Zeilen, die im echten Repo dazukommen (hier läuft der Hook ohne Git). Läuft auch in npm test.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
mkdir -p "$TMP/docs"
cp "$ROOT/docs/REQUIREMENTS.md" "$TMP/docs/"
open_ids=$(grep -oE '^- (🟡|❌) \*\*R-[0-9]+' "$ROOT/docs/REQUIREMENTS.md" | grep -oE 'R-[0-9]+' | sort -u)
fail=0
for p in 0 1 2 3 4 5 6 7; do
  sed -E "s/(\*\*Aktuelle Phase:\*\*) *P[0-9]+/\1 P$p/" "$ROOT/docs/PROGRESS.md" > "$TMP/docs/PROGRESS.md"
  out="$(CLAUDE_PROJECT_DIR="$TMP" HOOK_MAX_BYTES=8600 "$ROOT/.claude/hooks/session-start.sh")"
  chars=$(printf '%s' "$out" | python3 -c 'import sys; print(len(sys.stdin.read()))')
  missing=0
  idblock="$(printf '%s\n' "$out" | awk '/^Offene\/teilweise Punkte nach Phase/ {f=1; next} f && /^$/ {exit} f')"
  for id in $open_ids; do printf '%s' "$idblock" | grep -qE "(^|[^0-9])$id([^0-9]|$)" || missing=$((missing+1)); done
  gekuerzt=$(printf '%s' "$out" | grep -c 'gekürzt –' || true)
  next_ok=1; printf '%s' "$out" | grep -q '^## Nächster Schritt' || next_ok=0
  detail_ok=1
  if printf '%s' "$idblock" | grep -qE "^  P$p( \(AKTUELL\))?:"; then
    printf '%s' "$out" | grep -q "^Aktuelle Phase P$p im Detail" || detail_ok=0
    # vollständig: so viele Zeilen wie im Kopf angekündigt („(N offene Punkte“)
    want=$(printf '%s\n' "$out" | sed -nE "s/^Aktuelle Phase P$p im Detail \(([0-9]+) offene Punkte.*/\1/p")
    got=$(printf '%s\n' "$out" | awk '/^Aktuelle Phase P[0-9]+ im Detail/ {f=1; next} f && /^$/ {exit} f' | wc -l | tr -d ' ')
    [ -n "$want" ] && [ "$want" = "$got" ] || detail_ok=0
  fi
  echo "P$p: $chars Zeichen, fehlende offene IDs: $missing, Nächster Schritt: $next_ok, Kurzform: $detail_ok, gekürzt: $gekuerzt"
  if [ "$chars" -gt 9000 ] || [ "$missing" -gt 0 ] || [ "$next_ok" -eq 0 ] || [ "$detail_ok" -eq 0 ]; then fail=1; fi
done
[ "$fail" -eq 0 ] && echo "OK: Hook-Budget eingehalten, alle offenen IDs, Nächster Schritt und Kurzform enthalten." || { echo "FEHLER: Budget, IDs, Nächster Schritt oder Kurzform verletzt"; exit 1; }
