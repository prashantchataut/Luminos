#!/usr/bin/env bash
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
    *) [ -e "$ev" ] || { echo "MISSING EVIDENCE: $ev"; fail=1; };;
  esac
done < <(grep '^- \[x\]' "$L")
stubs=$(grep -rnIE 'todo!\(|unimplemented!\(|lorem ipsum|coming soon|FIXME|TODO\(' --exclude-dir={node_modules,target,.git,.agents,docs,scripts} . | wc -l)
[ "$stubs" -gt 0 ] && { echo "STUB MARKERS: $stubs"; fail=1; }
n=$(ls -1 .agents/skills 2>/dev/null | wc -l)
[ "$n" -ge 8 ] || { echo "SKILLS: only $n installed"; fail=1; }
b=$(git branch --show-current)
# CI status of the current branch: gh if present, else the public REST API (GH_TOKEN optional).
c=""
if command -v gh >/dev/null 2>&1; then
  c=$(gh run list --branch "$b" --limit 1 --json conclusion -q '.[0].conclusion' 2>/dev/null)
else
  auth=(); [ -n "${GH_TOKEN:-}" ] && auth=(-H "Authorization: Bearer $GH_TOKEN")
  c=$(curl -fsS "${auth[@]}" "https://api.github.com/repos/prashantchataut/Luminos/actions/runs?branch=$b&per_page=1" 2>/dev/null \
      | python3 -c 'import sys,json;r=json.load(sys.stdin)["workflow_runs"];print(r[0]["conclusion"] if r else "")' 2>/dev/null)
fi
[ "$c" = "success" ] || { echo "CI not green: '$c'"; fail=1; }
exit $fail
