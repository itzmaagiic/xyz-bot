#!/usr/bin/env bash
# SessionStart-Hook: gibt den Projektstand aus docs/PROGRESS.md und alle
# offenen Punkte (❌/🟡) aus docs/REQUIREMENTS.md aus.
# Die Ausgabe (stdout) landet als Kontext in der Session.
# Der Hook ändert keine Dateien und bricht nie den Session-Start ab.
set -u

ROOT="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "$0")/../.." && pwd)}"
PROGRESS="$ROOT/docs/PROGRESS.md"
REQS="$ROOT/docs/REQUIREMENTS.md"
MAX_CHARS=9000   # Claude Code kappt Hook-Ausgaben bei 10.000 Zeichen

out="$(
  echo "=== PROJEKTSTAND (automatisch aus docs/PROGRESS.md und docs/REQUIREMENTS.md) ==="
  echo "Pflicht vor jeder Aufgabe: CLAUDE.md, docs/REQUIREMENTS.md und docs/PROGRESS.md vollständig lesen."
  echo

  branch="$(git -C "$ROOT" rev-parse --abbrev-ref HEAD 2>/dev/null || echo '?')"
  last="$(git -C "$ROOT" log -1 --format='%h %s (%cr)' 2>/dev/null || echo '?')"
  echo "Git: Branch $branch · letzter Commit: $last"
  echo

  if [ -f "$PROGRESS" ]; then
    echo "--- docs/PROGRESS.md (ohne ältere Einträge unter „Erledigt“) ---"
    # Alles bis zur Überschrift „## Erledigt“ komplett, danach nur die 5 neuesten Punkte.
    awk '
      /^## Erledigt/ { in_done = 1; print; next }
      in_done && /^## / { in_done = 0 }
      in_done {
        if ($0 ~ /^- /) { n++; if (n <= 5) print; else if (n == 6) print "- … ältere Einträge siehe docs/PROGRESS.md" }
        next
      }
      { print }
    ' "$PROGRESS"
  else
    echo "WARNUNG: docs/PROGRESS.md fehlt."
  fi
  echo

  if [ -f "$REQS" ]; then
    total=$(grep -cE '^[[:space:]]*- (✅|🟡|❌) \*\*R-[0-9]+' "$REQS")
    done_n=$(grep -cE '^[[:space:]]*- ✅ \*\*R-[0-9]+' "$REQS")
    part_n=$(grep -cE '^[[:space:]]*- 🟡 \*\*R-[0-9]+' "$REQS")
    open_n=$(grep -cE '^[[:space:]]*- ❌ \*\*R-[0-9]+' "$REQS")
    echo "--- docs/REQUIREMENTS.md: $total Anforderungen · ✅ $done_n · 🟡 $part_n · ❌ $open_n ---"
    # Blocker-Hinweise (Zeilen, die mit „> ⚠️“ beginnen) immer zeigen.
    grep -E '^> ⚠️' "$REQS" || true
    echo "Offene und teilweise erledigte Punkte (Kurzform: Quelle/Nachweis weggelassen, Volltext in der Datei):"
    # Kurzform: Text vor „ — Quelle“, an Wortgrenze auf ca. 130 Zeichen gekürzt
    # (Wortgrenze, damit keine Mehrbyte-Zeichen zerschnitten werden).
    awk '
      /^#+ / { section = $0; shown = 0; next }
      /^[[:space:]]*- (🟡|❌) \*\*R-[0-9]+/ {
        if (!shown && section != "") { print section; shown = 1 }
        line = $0
        sub(/^[[:space:]]+/, "", line)
        cut = index(line, " — Quelle")
        if (cut > 0) line = substr(line, 1, cut - 1)
        n = split(line, w, " ")
        short = ""
        for (i = 1; i <= n; i++) {
          if (length(short) + length(w[i]) + 1 > 130) { short = short " …"; break }
          short = (short == "" ? w[i] : short " " w[i])
        }
        print short
      }
    ' "$REQS"
  else
    echo "WARNUNG: docs/REQUIREMENTS.md fehlt."
  fi
)"

if [ "${#out}" -gt "$MAX_CHARS" ]; then
  printf '%s\n' "${out:0:$MAX_CHARS}"
  echo "… [gekürzt – die vollständige Liste steht in docs/REQUIREMENTS.md und docs/PROGRESS.md, bitte dort lesen]"
else
  printf '%s\n' "$out"
fi
exit 0
