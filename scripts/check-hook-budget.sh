#!/usr/bin/env bash
# R-232: Prüft, dass die Ausgabe des SessionStart-Hooks für jede Phase P0–P7
# unter 9.000 Zeichen bleibt und jede offene R-ID (❌/🟡) darin vorkommt.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
mkdir -p "$TMP/docs"
cp "$ROOT/docs/REQUIREMENTS.md" "$TMP/docs/"
open_ids=$(grep -oE '^- (🟡|❌) \*\*R-[0-9]+' "$ROOT/docs/REQUIREMENTS.md" | grep -oE 'R-[0-9]+' | sort -u)
fail=0
for p in 0 1 2 3 4 5 6 7; do
  sed -E "s/(\*\*Aktuelle Phase:\*\*) *P[0-9]+/\1 P$p/" "$ROOT/docs/PROGRESS.md" > "$TMP/docs/PROGRESS.md"
  out="$(CLAUDE_PROJECT_DIR="$TMP" "$ROOT/.claude/hooks/session-start.sh")"
  chars=$(printf '%s' "$out" | python3 -c 'import sys; print(len(sys.stdin.read()))')
  missing=0
  for id in $open_ids; do printf '%s' "$out" | grep -qE "(^|[^0-9])$id([^0-9]|$)" || missing=$((missing+1)); done
  gekuerzt=$(printf '%s' "$out" | grep -c 'gekürzt –' || true)
  echo "P$p: $chars Zeichen, fehlende offene IDs: $missing, gekürzt: $gekuerzt"
  if [ "$chars" -gt 9000 ] || [ "$missing" -gt 0 ]; then fail=1; fi
done
[ "$fail" -eq 0 ] && echo "OK: Hook-Budget eingehalten, alle offenen IDs enthalten." || { echo "FEHLER: Budget oder IDs verletzt"; exit 1; }
