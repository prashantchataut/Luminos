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
stubs=$(grep -rnIE 'todo!\(|unimplemented!\(|lorem ipsum|coming soon|FIXME|TODO\(' --exclude-dir={node_modules,target,.git,.agents,docs} . | wc -l)
[ "$stubs" -gt 0 ] && { echo "STUB MARKERS: $stubs"; fail=1; }
n=$(ls -1 .agents/skills 2>/dev/null | wc -l)
[ "$n" -ge 8 ] || { echo "SKILLS: only $n installed"; fail=1; }
b=$(git branch --show-current)
c=$(gh run list --branch "$b" --limit 1 --json conclusion -q '.[0].conclusion' 2>/dev/null)
[ "$c" = "success" ] || { echo "CI not green: '$c'"; fail=1; }
exit $fail
