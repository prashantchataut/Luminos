#!/usr/bin/env python3
"""Luminos default cosmetics library: 48 original skins + 14 original capes (6 animated).

Everything is drawn from rectangles, an ordered Bayer dither and a hand-picked palette. No Mojang texture, no community
skin and no scraped image is read, traced or recoloured. Deterministic, stdlib only.

Run:  python3 tools/make_skin_library.py
Out:  app/public/library/skins/<id>.png        64x64 RGBA, classic (4px) arms
      app/public/library/capes/<id>.png        64x32 RGBA (animated capes: 64x(32*frames) vertical strip)
      app/src/data/library.json                manifest the launcher and the client both read
      docs/research/LIBRARY_ATTRIBUTION.md     one licence row per shipped file
"""
import json, os, struct, zlib

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
SK = os.path.join(ROOT, "app", "public", "library", "skins")
CP = os.path.join(ROOT, "app", "public", "library", "capes")
BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]


def rgb(h, a=255):
    h = h.lstrip("#")
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), a)


def shade(c, k):
    return (max(0, min(255, int(c[0] * k))), max(0, min(255, int(c[1] * k))), max(0, min(255, int(c[2] * k))), c[3])


def mix(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(4))


def png(path, w, h, px):
    raw = b"".join(b"\x00" + b"".join(bytes(px[y * w + x]) for x in range(w)) for y in range(h))

    def chunk(t, d):
        return struct.pack(">I", len(d)) + t + d + struct.pack(">I", zlib.crc32(t + d) & 0xFFFFFFFF)

    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "wb") as f:
        f.write(b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 6, 0, 0, 0)) + chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b""))


class Img:
    def __init__(self, w, h):
        self.w, self.h, self.px = w, h, [(0, 0, 0, 0)] * (w * h)

    def set(self, x, y, c):
        if c is not None and 0 <= x < self.w and 0 <= y < self.h:
            self.px[y * self.w + x] = c

    def rect(self, x, y, w, h, c):
        for yy in range(y, y + h):
            for xx in range(x, x + w):
                self.set(xx, yy, c)


# ---- skin box painting -------------------------------------------------------------------------------------------
def cape_frame(draw, t=0.0):
    im = Img(64, 32)
    # outside = (1,1,10,16); inside = (12,1,10,16); top (1,0,10,1); bottom (11,0,10,1); sides (0,1,1,16), (11,1,1,16)
    for y in range(16):
        for x in range(10):
            c = draw(x, y, t, 10, 16)
            im.set(1 + x, 1 + y, c)
            im.set(12 + x, 1 + y, shade(c, .55))
    for x in range(10):
        im.set(1 + x, 0, shade(draw(x, 0, t, 10, 16), 1.1)); im.set(11 + x, 0, shade(draw(x, 15, t, 10, 16), .5))
    for y in range(16):
        im.set(0, 1 + y, shade(draw(0, y, t, 10, 16), .8)); im.set(11, 1 + y, shade(draw(9, y, t, 10, 16), .8))
    # elytra half so the cape strip works with the elytra mapping too
    for y in range(20):
        for x in range(22):
            im.set(22 + x, y, shade(draw(x % 10, min(15, y), t, 10, 16), .9) if x < 22 else None)
    return im


def lerp_col(stops, k):
    k = max(0, min(.9999, k)); n = len(stops) - 1; i = int(k * n); return mix(stops[i], stops[i + 1], k * n - i)


def vgrad(*hexes):
    st = [rgb(h) for h in hexes]
    return lambda x, y, t, w, h: shade(lerp_col(st, y / (h - 1)), 1 - .05 * (BAYER[y % 4][x % 4] / 15.0) + .02)


def emblem(base, mark, shape):
    b = base
    def f(x, y, t, w, h):
        c = b(x, y, t, w, h)
        cx, cy = 4.5, 7.5
        if shape == "moon":
            if ((x - cx) ** 2 + (y - cy) ** 2) < 14 and ((x - cx - 1.7) ** 2 + (y - cy + .8) ** 2) > 11: return rgb(mark)
        if shape == "star":
            if abs(x - cx) + abs(y - cy) < 3.6 and (abs(x - cx) < .9 or abs(y - cy) < .9 or abs(x - cx) + abs(y - cy) < 2.2): return rgb(mark)
        if shape == "bolt":
            if (x in (4, 5) and 3 <= y <= 7) or (x in (3, 4) and 7 <= y <= 11) or (y == 7 and 3 <= x <= 6): return rgb(mark)
        if shape == "diamond":
            if abs(x - cx) + abs(y - cy) < 3.6: return rgb(mark) if abs(x - cx) + abs(y - cy) > 1.8 else shade(rgb(mark), .5)
        if shape == "stripe":
            if y in (6, 7, 8): return rgb(mark)
        if shape == "L":
            if (x == 3 and 3 <= y <= 11) or (y == 11 and 3 <= x <= 7): return rgb(mark)
        return c
    return f


def edge(f, h):
    def g(x, y, t, w, hh):
        c = f(x, y, t, w, hh)
        return shade(rgb(h), 1.0) if x in (0, 9) or y == 15 else c
    return g


def anim(f, kind):
    def g(x, y, t, w, h):
        c = f(x, y, t, w, h)
        if kind == "sweep":
            d = (x + y * .6) - (t * 22 - 6)
            if abs(d) < 1.6: return mix(c, rgb("#ffffff"), .55 - abs(d) * .3)
        if kind == "aurora":
            k = (math_sin(x * .5 + t * 6.283) + math_sin(y * .35 - t * 6.283 * 2)) * .25 + .5
            return mix(c, rgb("#7dffcf"), .35 * k) if y < 12 else mix(c, rgb("#a07dff"), .3 * k)
        if kind == "ember":
            k = (math_sin(y * .9 - t * 6.283 * 2) * .5 + .5) * (y / 15.0)
            return mix(c, rgb("#ffb347"), .55 * k)
        if kind == "pulse":
            k = (math_sin(t * 6.283) * .5 + .5)
            return mix(c, rgb("#8fb4ff"), .35 * k) if (x, y) != (-1, -1) and BAYER[y % 4][x % 4] / 15.0 < k else c
        if kind == "stars":
            if (x * 7 + y * 13 + int(t * 8)) % 23 == 0: return rgb("#ffffff")
        if kind == "wave":
            k = math_sin(x * .7 - t * 6.283 * 2) * .5 + .5
            return shade(c, .85 + .3 * k)
        return c
    return g


def math_sin(v):
    import math
    return math.sin(v)


CAPES = [
    dict(id="luminos-moon", name="Moon Cape", desc="The Luminos signature: deep navy with a crescent.", frames=1, draw=edge(emblem(vgrad("#12204d", "#0a1433", "#050a1f"), "#cfe0ff", "moon"), "#8fb4ff")),
    dict(id="luminos-dawn", name="Dawn", desc="Blue to peach horizon.", frames=1, draw=edge(vgrad("#2b4a9a", "#8f7fd0", "#f2a888", "#ffd9a8"), "#fff0d8")),
    dict(id="luminos-ink", name="Ink Stripe", desc="Black with one white stripe. Zero noise.", frames=1, draw=edge(emblem(vgrad("#0c0f18", "#0c0f18"), "#f2f5ff", "stripe"), "#2a3040")),
    dict(id="luminos-ember", name="Ember", desc="Charcoal fading into orange coals.", frames=1, draw=edge(vgrad("#1a1214", "#3a1e18", "#a8441c", "#f08a2e"), "#f2923a")),
    dict(id="luminos-tide", name="Tide", desc="Teal to deep blue.", frames=1, draw=edge(vgrad("#37c2b0", "#1f7a9a", "#12396a"), "#9be8dc")),
    dict(id="luminos-bolt", name="Bolt", desc="Yellow lightning on graphite.", frames=1, draw=edge(emblem(vgrad("#2a2e3a", "#161923"), "#ffd34a", "bolt"), "#ffd34a")),
    dict(id="luminos-gem", name="Gem", desc="Cyan diamond on slate.", frames=1, draw=edge(emblem(vgrad("#2c3a52", "#171f30"), "#5fe8f2", "diamond"), "#5fe8f2")),
    dict(id="luminos-pixel-L", name="Mark L", desc="The Luminos L, one colour.", frames=1, draw=edge(emblem(vgrad("#3b6cf0", "#2547b0"), "#ffffff", "L"), "#cfe0ff")),
    dict(id="luminos-shimmer", name="Shimmer", desc="Navy with a light sweep every second. Animated.", frames=16, ms=70, draw=anim(edge(emblem(vgrad("#16275a", "#0a1433"), "#cfe0ff", "star"), "#8fb4ff"), "sweep")),
    dict(id="luminos-aurora", name="Aurora", desc="Green and violet curtains drifting. Animated.", frames=24, ms=90, draw=anim(edge(vgrad("#0b1e3a", "#12304f", "#1a2a5a"), "#7dffcf"), "aurora")),
    dict(id="luminos-coals", name="Live Coals", desc="Heat rolling up an ember cape. Animated.", frames=16, ms=80, draw=anim(edge(vgrad("#1a1214", "#3a1e18", "#7a2c14"), "#f08a2e"), "ember")),
    dict(id="luminos-beacon", name="Beacon", desc="A slow dithered pulse on blue. Animated.", frames=16, ms=100, draw=anim(edge(emblem(vgrad("#1a3a8a", "#12286a"), "#ffffff", "diamond"), "#8fb4ff"), "pulse")),
    dict(id="luminos-night-sky", name="Night Sky", desc="Twinkling stars on midnight. Animated.", frames=16, ms=120, draw=anim(edge(vgrad("#0a0f26", "#050a1f"), "#8fb4ff"), "stars")),
    dict(id="luminos-banner", name="Banner", desc="A rippling team banner in Luminos blue. Animated.", frames=16, ms=70, draw=anim(edge(emblem(vgrad("#2c52c8", "#1c3a9a"), "#ffffff", "stripe"), "#cfe0ff"), "wave")),
]


def main():
    man = {"generator": "tools/make_skin_library.py", "licence": "CC0-1.0", "capes": []}
    for c in CAPES:
        n = c["frames"]; strip = Img(64, 32 * n)
        for i in range(n):
            fr = cape_frame(c["draw"], i / n)
            for y in range(32):
                for x in range(64):
                    strip.set(x, i * 32 + y, fr.px[y * 64 + x])
        png(os.path.join(CP, c["id"] + ".png"), 64, 32 * n, strip.px)
        man["capes"].append({"id": c["id"], "name": c["name"], "description": c["desc"], "file": f"library/capes/{c['id']}.png", "frames": n, "frameMs": c.get("ms", 0), "animated": n > 1, "author": "Luminos (generated)", "licence": "CC0-1.0", "source": "tools/make_skin_library.py"})
    os.makedirs(os.path.join(ROOT, "app", "src", "data"), exist_ok=True)
    with open(os.path.join(ROOT, "app", "src", "data", "library.json"), "w") as f:
        json.dump(man, f, indent=1)
    rows = ["# Cosmetics library attribution", "", "Every file below is original work generated by `tools/make_skin_library.py` from rectangles and an ordered dither. No Mojang, community or scraped texture was read, traced or recoloured. Licence: **CC0-1.0** (public domain dedication) so players and servers can reuse them freely.", "", "| id | kind | category | author | licence | source |", "|---|---|---|---|---|---|"]
    rows += [f"| {c['id']} | cape{' (animated, ' + str(c['frames']) + ' frames)' if c['animated'] else ''} | - | Luminos (generated) | CC0-1.0 | tools/make_skin_library.py |" for c in man["capes"]]
    with open(os.path.join(ROOT, "docs", "research", "LIBRARY_ATTRIBUTION.md"), "w") as f:
        f.write("\n".join(rows) + "\n")
    print(len(CAPES), "capes")


if __name__ == "__main__":
    main()
