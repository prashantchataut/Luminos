#!/usr/bin/env python3
"""Checks for the B2 icon set: grid size, palette, minimum content, uniqueness, determinism."""
import hashlib, os, subprocess, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import make_icons as m

ic = m.icons()
assert len(ic) >= 29, len(ic)
groups = {k.split("/")[0] for k in ic}
assert groups == {"versions", "loaders", "modes", "items", "categories"}, groups
assert sum(k.startswith("versions/") for k in ic) == 5
seen = {}
for k, cv in ic.items():
    assert all(0 <= x < m.N and 0 <= y < m.N for x, y in cv.p), k
    assert all(c in m.PAL for c in cv.p.values()), k
    assert len(cv.p) >= 40, f"{k} nearly empty ({len(cv.p)} px)"
    assert any(c == "k" for c in cv.p.values()), f"{k} has no outline"
    sig = tuple(sorted(cv.p.items()))
    assert sig not in seen, f"{k} duplicates {seen[sig]}"
    seen[sig] = k
# no violet/lavender anywhere in the palette (taste-skill TASTE-6)
for c, h in m.PAL.items():
    r, g, b = m.hex_rgb(h)
    assert not (r > g + 25 and b > g + 25), f"violet-ish colour {c} {h}"

def digest():
    h = hashlib.sha256()
    for root in ("svg", "png"):
        d = os.path.join(m.OUT, root)
        for f in sorted(os.listdir(d)):
            h.update(f.encode()); h.update(open(os.path.join(d, f), "rb").read())
    h.update(open(os.path.join(m.OUT, "sheet.png"), "rb").read())
    return h.hexdigest()

m.main(); a = digest(); m.main(); b = digest()
assert a == b, "generator is not deterministic"
print(f"OK: {len(ic)} icons, 5 groups, deterministic sha256={a[:16]}")
