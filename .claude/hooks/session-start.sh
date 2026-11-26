#!/usr/bin/env bash
# SessionStart-Hook: gibt den Projektstand aus docs/PROGRESS.md und die offenen
# Punkte (❌/🟡) aus docs/REQUIREMENTS.md aus (D-002, D-015).
# Die Ausgabe (stdout) landet als Kontext in der Session.
# Der Hook ändert keine Dateien und bricht nie den Session-Start ab.
# Reihenfolge (Wichtiges zuerst): Pflichthinweis → Git und Remote-Branches → Zählung, Blocker und IDs ALLER offenen
# Punkte je Phase → PROGRESS-Kopf (Stand, Phase, In Arbeit, Nächster Schritt) → Kurzform der aktuellen Phase
# (Zeilenlänge passt sich an DETAIL_BYTES an) → Rest von PROGRESS (ohne Vorbefunde-Details, alte „Erledigt“-Einträge
# und Vorgänger-Anhang). Gekürzt wird zeilenweise auf MAX_BYTES (Hook-Limit: 10.000 Zeichen), also nur am Ende.
set -u

ROOT="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "$0")/../.." && pwd)}"
PROGRESS="$ROOT/docs/PROGRESS.md"
REQS="$ROOT/docs/REQUIREMENTS.md"
MAX_BYTES="${HOOK_MAX_BYTES:-9000}"
DETAIL_BYTES="${HOOK_DETAIL_BYTES:-2800}"   # Budget für die Kurzform der aktuellen Phase

# Befehl mit Zeitlimit (Linux: timeout, macOS ohne coreutils: perl alarm)
run_limited() {
  local secs="$1"; shift
  if command -v timeout >/dev/null 2>&1; then timeout "$secs" "$@"
  elif command -v perl >/dev/null 2>&1; then
    # eigene Prozessgruppe, beim Zeitlimit wird die ganze Gruppe beendet (auch ssh-Kindprozesse von git)
    perl -e 'my $s = shift; my $pid = fork; exit 125 unless defined $pid;
      if ($pid == 0) { setpgrp(0, 0); exec @ARGV or exit 127 }
      $SIG{ALRM} = sub { kill "TERM", -$pid; exit 124 }; alarm $s; waitpid($pid, 0); exit($? >> 8)' "$secs" "$@"
  else "$@"; fi
}

DETAIL="$(mktemp 2>/dev/null || echo /tmp/pk-hook-detail.$$)"
trap 'rm -f "$DETAIL"' EXIT
{
  echo "=== PROJEKTSTAND (automatisch aus docs/PROGRESS.md und docs/REQUIREMENTS.md) ==="
  echo "Pflicht vor jeder Aufgabe: CLAUDE.md, docs/REQUIREMENTS.md und docs/PROGRESS.md vollständig lesen."
  branch="$(git -C "$ROOT" rev-parse --abbrev-ref HEAD 2>/dev/null || echo '?')"
  last="$(git -C "$ROOT" log -1 --format='%h %s (%cr)' 2>/dev/null || echo '?')"
  echo "Git: Branch $branch · letzter Commit: $last"
  # R-247: Branches auf origin, deren Stand nicht in HEAD steckt – Vorarbeit nicht übersehen (D-016).
  # Höchstens 5 s, ohne Passwortabfrage; ohne Netz nur ein Hinweis, nie ein Abbruch.
  if git -C "$ROOT" remote get-url origin >/dev/null 2>&1; then
    if refs="$(GIT_TERMINAL_PROMPT=0 run_limited 5 git -C "$ROOT" ls-remote --heads origin 2>/dev/null)"; then
      # bekannte, erledigte Branches: "name  sha  Begründung" je Zeile, # = Kommentar.
      # Nur solange der Stand des Branches mit dem eingetragenen SHA beginnt; neue Commits lösen wieder die Warnung aus.
      HANDLED="$ROOT/.claude/hooks/branches-handled.txt"
      unmerged=""; handled=""
      while read -r sha ref; do
        [ -z "$sha" ] && continue
        # GIT_NO_LAZY_FETCH: in partiellen Klonen nichts nachladen (kein Netz außerhalb des Zeitlimits)
        if ! GIT_NO_LAZY_FETCH=1 git -C "$ROOT" cat-file -e "$sha^{commit}" 2>/dev/null \
          || ! GIT_NO_LAZY_FETCH=1 git -C "$ROOT" merge-base --is-ancestor "$sha" HEAD 2>/dev/null; then
          name="${ref#refs/heads/}"
          entry="$( [ -f "$HANDLED" ] && awk -v n="$name" '$1 == n { $1 = ""; sub(/^ +/, ""); print; exit }' "$HANDLED" )"
          known="${entry%% *}"; why="${entry#* }"
          if [ -n "$entry" ] && [ -n "$known" ] && [ "${sha#"$known"}" != "$sha" ]; then
            handled="$handled${handled:+; }$name (${sha:0:7}): $why"
          elif [ -n "$entry" ]; then
            unmerged="$unmerged${unmerged:+, }$name (${sha:0:7}, neuer Stand seit Eintrag $known)"
          else
            unmerged="$unmerged${unmerged:+, }$name (${sha:0:7})"
          fi
        fi
      done <<< "$refs"
      shallow=""
      [ "$(git -C "$ROOT" rev-parse --is-shallow-repository 2>/dev/null)" = "true" ] \
        && shallow=" (flacher Klon: ältere, schon gemergte Stände können hier fälschlich erscheinen)"
      [ -n "$unmerged" ] && echo "⚠️ Remote-Branches mit Stand, der nicht in HEAD enthalten ist: $unmerged → prüfen und ggf. mergen (D-016, R-247)$shallow"
      [ -n "$handled" ] && echo "ℹ️ Bekannte Remote-Branches, nicht mergen: $handled"
    else
      echo "Hinweis: Remote-Branches nicht geprüft (kein Zugriff auf origin)."
    fi
  fi
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
        # Kurzform: Status, ID und Text vor „ — Quelle“ (gekürzt wird im END-Block passend zum Budget)
        line = $0; sub(/^[[:space:]]+/, "", line)
        cut = index(line, " — Quelle"); if (cut > 0) line = substr(line, 1, cut - 1)
        sub(/\*\*R-/, "R-", line); sub(/\*\* \[P[0-9]+\]/, "", line)
        gsub(/~~[^~]*~~ *(→ *)?/, "", line)              # durchgestrichener Alttext gehört nicht in die Kurzform
        n_items++; item[n_items] = line; item_sec[n_items] = section
      }
      END {
        print "Offene/teilweise Punkte nach Phase (IDs, 🟡 = teilweise):"
        for (i = 0; i <= 9; i++) { t = "P" i; if (t in ids) print "  " t ((t == phase) ? " (AKTUELL)" : "") ":" ids[t] }
        if ("P?" in ids) print "  ohne Phasen-Tag:" ids["P?"]
        print ""
        if (detail_file != "" && n_items > 0) {
          # Zeilenlänge so wählen, dass die Kurzform ins Budget passt (große Phasen: kürzer, mindestens 40 Bytes)
          width = int(budget / n_items) - 4; if (width > 110) width = 110; if (width < 40) width = 40
          print "Aktuelle Phase " phase " im Detail (" n_items " offene Punkte, Kurzform, Volltext in docs/REQUIREMENTS.md):" > detail_file
          for (k = 1; k <= n_items; k++) {
            n = split(item[k], w, " "); short = ""
            for (i = 1; i <= n; i++) {
              if (length(short) + length(w[i]) + 1 > width) { short = short " …"; break }
              short = (short == "" ? w[i] : short " " w[i])
            }
            print short > detail_file
          }
        }
      }
    ' detail_file="$DETAIL" budget="$DETAIL_BYTES" "$REQS"
  else
    echo "WARNUNG: docs/REQUIREMENTS.md fehlt."
  fi
  echo
  if [ -f "$PROGRESS" ]; then
    echo "--- docs/PROGRESS.md, Kopf (Stand, Phase, In Arbeit, Nächster Schritt) ---"
    awk '/^## Entscheidungen/ || /^---[[:space:]]*$/ { exit } { print }' "$PROGRESS"
  else
    echo "WARNUNG: docs/PROGRESS.md fehlt."
  fi
  echo
  [ -s "$DETAIL" ] && { cat "$DETAIL"; echo; }
  if [ -f "$PROGRESS" ]; then
    echo "--- docs/PROGRESS.md, Rest (ohne Vorbefunde-Details, 3 neueste „Erledigt“-Einträge, ohne Vorgänger-Anhang) ---"
    awk '
      /^## Entscheidungen/ { on = 1 }
      !on { next }
      /^---[[:space:]]*$/ { exit }                      # ab hier folgt der wörtliche Vorgänger-Anhang
      /^## Vorbefunde/ { skip = 1; print; print "(Abschnitt gekürzt: Volltext in docs/PROGRESS.md lesen)"; next }
      skip && /^## / { skip = 0 }
      skip { next }
      /^## Erledigt/ { in_done = 1; print; next }
      in_done && /^## / { in_done = 0 }
      in_done {
        if ($0 ~ /^- /) { n++; if (n <= 3) print; else if (n == 4) print "- … ältere Einträge siehe docs/PROGRESS.md" }
        else if ($0 ~ /^[[:space:]]+- / && n <= 3) print     # Unterpunkte der drei neuesten Einträge
        next
      }
      { print }
    ' "$PROGRESS"
  fi
} | awk -v max="$MAX_BYTES" '
  # Zeilenweise kürzen, also nie mitten in einem UTF-8-Zeichen. length() zählt je nach awk
  # Bytes (mawk) oder Zeichen (gawk mit UTF-8); beides bleibt unter dem Zeichenlimit.
  { b = length($0) + 1; if (used + b > max - 120) { cut = 1; exit } used += b; print }
  END { if (cut) print "… [gekürzt – Rest in docs/PROGRESS.md und docs/REQUIREMENTS.md lesen]" }
'
exit 0
