#!/usr/bin/env bash
# SessionStart-Hook: gibt den Projektstand aus docs/PROGRESS.md und die offenen
# Punkte (❌/🟡) aus docs/REQUIREMENTS.md aus (D-002, D-015).
# Die Ausgabe (stdout) landet als Kontext in der Session.
# Der Hook ändert keine Dateien und bricht nie den Session-Start ab.
# Reihenfolge: Pflichthinweis → Git → Zählung, Blocker und IDs ALLER offenen Punkte je Phase →
# PROGRESS (ohne Vorbefunde-Details, alte „Erledigt“-Einträge und Vorgänger-Anhang) →
# Kurzform der aktuellen Phase. Gekürzt wird zeilenweise auf MAX_BYTES (Hook-Limit: 10.000 Zeichen).
set -u

ROOT="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "$0")/../.." && pwd)}"
PROGRESS="$ROOT/docs/PROGRESS.md"
REQS="$ROOT/docs/REQUIREMENTS.md"
MAX_BYTES="${HOOK_MAX_BYTES:-9000}"

DETAIL="$(mktemp 2>/dev/null || echo /tmp/pk-hook-detail.$$)"
trap 'rm -f "$DETAIL"' EXIT
{
  echo "=== PROJEKTSTAND (automatisch aus docs/PROGRESS.md und docs/REQUIREMENTS.md) ==="
  echo "Pflicht vor jeder Aufgabe: CLAUDE.md, docs/REQUIREMENTS.md und docs/PROGRESS.md vollständig lesen."
  branch="$(git -C "$ROOT" rev-parse --abbrev-ref HEAD 2>/dev/null || echo '?')"
  last="$(git -C "$ROOT" log -1 --format='%h %s (%cr)' 2>/dev/null || echo '?')"
  echo "Git: Branch $branch · letzter Commit: $last"
  echo

  if [ -f "$REQS" ]; then
    total=$(grep -cE '^[[:space:]]*- (✅|🟡|❌) \*\*R-[0-9]+' "$REQS")
    done_n=$(grep -cE '^[[:space:]]*- ✅ \*\*R-[0-9]+' "$REQS")
    part_n=$(grep -cE '^[[:space:]]*- 🟡 \*\*R-[0-9]+' "$REQS")
    open_n=$(grep -cE '^[[:space:]]*- ❌ \*\*R-[0-9]+' "$REQS")
    echo "--- docs/REQUIREMENTS.md: $total Anforderungen · ✅ $done_n · 🟡 $part_n · ❌ $open_n ---"
    grep -E '^> ⚠️' "$REQS" || true                    # Blocker-Hinweise immer zeigen

    phase="$(grep -oE 'Aktuelle Phase:\*\* *P[0-9]+' "$PROGRESS" 2>/dev/null | grep -oE 'P[0-9]+' | head -1)"
    [ -z "$phase" ] && phase="?"
    awk -v phase="$phase" '
      /^#+ / { section = $0; next }
      /^[[:space:]]*- (🟡|❌) \*\*R-[0-9]+/ {
        id = ""; tag = "P?"; st = ($0 ~ /🟡/) ? "🟡" : ""
        if (match($0, /R-[0-9]+/)) id = substr($0, RSTART, RLENGTH)
        if (match($0, /\[P[0-9]+\]/)) tag = substr($0, RSTART + 1, RLENGTH - 2)
        ids[tag] = ids[tag] " " id st
        if (tag != phase) next
        # Kurzform: Text vor „ — Quelle“, an Wortgrenze auf ca. 100 Bytes gekürzt
        line = $0; sub(/^[[:space:]]+/, "", line)
        cut = index(line, " — Quelle"); if (cut > 0) line = substr(line, 1, cut - 1)
        n = split(line, w, " "); short = ""
        for (i = 1; i <= n; i++) {
          if (length(short) + length(w[i]) + 1 > 100) { short = short " …"; break }
          short = (short == "" ? w[i] : short " " w[i])
        }
        if (section != last_section) { cur = cur section "\n"; last_section = section }
        cur = cur short "\n"
      }
      END {
        print "Offene/teilweise Punkte nach Phase (IDs, 🟡 = teilweise):"
        for (i = 0; i <= 9; i++) { t = "P" i; if (t in ids) print "  " t ((t == phase) ? " (AKTUELL)" : "") ":" ids[t] }
        if ("P?" in ids) print "  ohne Phasen-Tag:" ids["P?"]
        print ""
        if (detail_file != "") {
          print "Aktuelle Phase " phase " im Detail (Kurzform, Volltext in docs/REQUIREMENTS.md):" > detail_file
          printf "%s", cur > detail_file
        }
      }
    ' detail_file="$DETAIL" "$REQS"
  else
    echo "WARNUNG: docs/REQUIREMENTS.md fehlt."
  fi
  echo
  if [ -f "$PROGRESS" ]; then
    echo "--- docs/PROGRESS.md (gekürzt: ohne Vorbefunde-Details, 3 neueste „Erledigt“-Einträge, ohne Vorgänger-Anhang) ---"
    awk '
      /^---[[:space:]]*$/ { exit }                      # ab hier folgt der wörtliche Vorgänger-Anhang
      /^## Vorbefunde/ { skip = 1; print; print "(Abschnitt gekürzt: Volltext in docs/PROGRESS.md lesen)"; next }
      skip && /^## / { skip = 0 }
      skip { next }
      /^## Erledigt/ { in_done = 1; print; next }
      in_done && /^## / { in_done = 0 }
      in_done {
        if ($0 ~ /^- /) { n++; if (n <= 3) print; else if (n == 4) print "- … ältere Einträge siehe docs/PROGRESS.md" }
        next
      }
      { print }
    ' "$PROGRESS"
  else
    echo "WARNUNG: docs/PROGRESS.md fehlt."
  fi
  echo

  [ -s "$DETAIL" ] && cat "$DETAIL"
} | awk -v max="$MAX_BYTES" '
  # Zeilenweise kürzen, also nie mitten in einem UTF-8-Zeichen. length() zählt je nach awk
  # Bytes (mawk) oder Zeichen (gawk mit UTF-8); beides bleibt unter dem Zeichenlimit.
  { b = length($0) + 1; if (used + b > max - 120) { cut = 1; exit } used += b; print }
  END { if (cut) print "… [gekürzt – Rest in docs/PROGRESS.md und docs/REQUIREMENTS.md lesen]" }
'
exit 0
