#!/usr/bin/env bash
# Done-gate. Exit 0 only when: ledger has no open items, every ticked item has real non-empty evidence,
# no stub markers, >= 8 skills, and EVERY workflow run on the exact HEAD commit succeeded.
set -u
fail=0; L=docs/LEDGER.md
[ -f "$L" ] || { echo "no ledger"; exit 1; }
open=$(grep -c '^- \[ \]' "$L")
if [ "$open" -gt 0 ]; then echo "OPEN ITEMS: $open"; grep -m8 '^- \[ \]' "$L"; fail=1; fi
while IFS= read -r line; do
  ev=$(echo "$line" | sed -n 's/.*evidence: *//p' | awk '{print $1}')
  case "$ev" in
    "") echo "NO EVIDENCE: $line"; fail=1;;
    http*) ;;
    *) if [ -d "$ev" ]; then [ -n "$(ls -A "$ev")" ] || { echo "EMPTY EVIDENCE DIR: $ev"; fail=1; }
       elif [ -s "$ev" ]; then :; else echo "MISSING/EMPTY EVIDENCE: $ev"; fail=1; fi;;
  esac
done < <(grep '^- \[x\]' "$L")
stubs=$(grep -rnIE 'todo!\(|unimplemented!\(|lorem ipsum|coming soon|FIXME|TODO\(' --exclude-dir={node_modules,target,.git,.agents,docs,scripts,build,dist} . | wc -l)
[ "$stubs" -gt 0 ] && { echo "STUB MARKERS: $stubs"; fail=1; }
n=$(ls -1 .agents/skills 2>/dev/null | wc -l)
[ "$n" -ge 8 ] || { echo "SKILLS: only $n installed"; fail=1; }
# CI on the exact HEAD commit (all workflows). Needs the commit pushed. GH_TOKEN optional.
sha=$(git rev-parse HEAD)
auth=(); [ -n "${GH_TOKEN:-}" ] && auth=(-H "Authorization: Bearer $GH_TOKEN")
resp=$(curl -fsS "${auth[@]}" "https://api.github.com/repos/prashantchataut/Luminos/actions/runs?head_sha=$sha&per_page=50" 2>/dev/null || true)
ci=$(printf '%s' "$resp" | python3 -c '
import sys,json
try: runs=json.load(sys.stdin)["workflow_runs"]
except Exception: print("UNKNOWN: could not query GitHub"); sys.exit()
if not runs: print("NONE: no workflow ran on this commit (push it)"); sys.exit()
bad=[f"{r[\"name\"]}={r[\"conclusion\"] or r[\"status\"]}" for r in runs if r["conclusion"] not in ("success","skipped")]
print("BAD: "+", ".join(bad) if bad else "OK")' 2>/dev/null)
case "$ci" in OK) ;; *) echo "CI on $sha: $ci"; fail=1;; esac
exit $fail
