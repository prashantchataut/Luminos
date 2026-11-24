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
def faces(u, v, w, h, d):
    return {"top": (u + d, v, w, d), "bottom": (u + d + w, v, w, d), "right": (u, v + d, d, h), "front": (u + d, v + d, w, h),
            "left": (u + d + w, v + d, d, h), "back": (u + d + w + d, v + d, w, h)}


LIGHT = {"top": 1.12, "front": 1.0, "back": .86, "right": .93, "left": .93, "bottom": .72}


def paint_box(img, u, v, w, h, d, col, tex=0.06, fn=None):
    """Fill the 6 faces; fn(face, lx, ly, fw, fh) may return a colour to override a pixel."""
    for name, (fx, fy, fw, fh) in faces(u, v, w, h, d).items():
        for ly in range(fh):
            for lx in range(fw):
                c = shade(col, LIGHT[name] * (1 - tex + tex * 2 * ((BAYER[(fy + ly) % 4][(fx + lx) % 4]) / 15.0)))
                o = fn(name, lx, ly, fw, fh) if fn else None
                img.set(fx + lx, fy + ly, o if o else c)


PARTS = {  # base box, overlay box
    "head": ((0, 0, 8, 8, 8), (32, 0)), "body": ((16, 16, 8, 12, 4), (16, 32)), "rarm": ((40, 16, 4, 12, 4), (40, 32)),
    "larm": ((32, 48, 4, 12, 4), (48, 48)), "rleg": ((0, 16, 4, 12, 4), (0, 32)), "lleg": ((16, 48, 4, 12, 4), (0, 48)),
}


def overlay_box(img, part, col, fn=None, grow=True):
    (u, v, w, h, d) = PARTS[part][0]
    ou, ov = PARTS[part][1]
    paint_box(img, ou, ov, w, h, d, col, tex=0.04, fn=fn)


def clear_overlay(img, part, keep=None):
    (u, v, w, h, d) = PARTS[part][0]
    ou, ov = PARTS[part][1]
    for (fx, fy, fw, fh) in faces(ou, ov, w, h, d).values():
        img.rect(fx, fy, fw, fh, (0, 0, 0, 0))


def front(img, part, ox, oy, c, overlay=False, w=1, h=1):
    """Pixel on the FRONT face of a part (lx, ly local)."""
    (u, v, bw, bh, d) = PARTS[part][0]
    if overlay:
        u, v = PARTS[part][1]
    img.rect(u + d + ox, v + d + oy, w, h, c)


def back(img, part, ox, oy, c, overlay=False, w=1, h=1):
    (u, v, bw, bh, d) = PARTS[part][0]
    if overlay:
        u, v = PARTS[part][1]
    img.rect(u + d + bw + d + ox, v + d + oy, w, h, c)


def top(img, part, ox, oy, c, overlay=False, w=1, h=1):
    (u, v, bw, bh, d) = PARTS[part][0]
    if overlay:
        u, v = PARTS[part][1]
    img.rect(u + d + ox, v + oy, w, h, c)


def side(img, part, which, ox, oy, c, overlay=False, w=1, h=1):
    (u, v, bw, bh, d) = PARTS[part][0]
    if overlay:
        u, v = PARTS[part][1]
    x0 = u if which == "right" else u + d + bw
    img.rect(x0 + ox, v + d + oy, w, h, c)


# ---- character builder ------------------------------------------------------------------------------------------
def build(s):
    im = Img(64, 64)
    skin, hair, shirt, pants, shoes = (rgb(s[k]) for k in ("skin", "hair", "shirt", "pants", "shoes"))
    eye = rgb(s.get("eye", "#2a3b6b"))
    # head: skin, then hair
    paint_box(im, 0, 0, 8, 8, 8, skin, 0.05)
    style = s.get("hairstyle", "short")
    if style != "none":
        def hairfn(face, lx, ly, fw, fh):
            if face == "top" or face == "bottom":
                return shade(hair, 1.1) if face == "top" else None
            if face == "back":
                return shade(hair, .86) if style != "buzz" or ly < 3 else None
            if face == "front":
                lim = {"short": 2, "buzz": 1, "spiky": 2, "long": 2, "bob": 3, "fringe": 3}.get(style, 2)
                if style == "fringe":
                    return shade(hair, 1 + .06 * (lx % 2)) if ly < 3 or (ly < 4 and lx % 3 != 1) else None
                if style == "spiky" and ly == 2 and lx % 2 == 0:
                    return None
                return shade(hair, 1.0 + (.05 if lx % 2 else 0)) if ly < lim else None
            lim = {"short": 3, "buzz": 2, "spiky": 3, "long": 8, "bob": 6, "fringe": 4}.get(style, 3)
            return shade(hair, .93) if ly < lim else None
        paint_box(im, 0, 0, 8, 8, 8, skin, 0.05, hairfn)
    # face
    front(im, "head", 1, 4, rgb("#ffffff"), w=2)
    front(im, "head", 5, 4, rgb("#ffffff"), w=2)
    front(im, "head", 2, 4, eye)
    front(im, "head", 5, 4, eye)
    if s.get("brows", True):
        front(im, "head", 1, 3, shade(hair, .8), w=2)
        front(im, "head", 5, 3, shade(hair, .8), w=2)
    front(im, "head", 3, 6, shade(skin, .66), w=2)
    if s.get("blush"):
        front(im, "head", 0, 5, rgb("#f08aa0"), w=1)
        front(im, "head", 7, 5, rgb("#f08aa0"), w=1)
    # body + limbs
    paint_box(im, 16, 16, 8, 12, 4, shirt, 0.07)
    for part in ("rarm", "larm"):
        (u, v, w, h, d) = PARTS[part][0]
        paint_box(im, u, v, w, h, d, shirt, 0.07, lambda f, lx, ly, fw, fh: shade(skin, LIGHT[f]) if ly >= fh - 3 else None)
    for part in ("rleg", "lleg"):
        (u, v, w, h, d) = PARTS[part][0]
        paint_box(im, u, v, w, h, d, pants, 0.07, lambda f, lx, ly, fw, fh: shade(shoes, LIGHT[f]) if ly >= fh - 3 else None)
    s["fx"](im, s) if s.get("fx") else None
    return im


# ---- feature painters (one per archetype) -----------------------------------------------------------------------
def fx_flannel(im, s):
    a = rgb(s["accent"])
    for y in range(12):
        for x in range(8):
            if x % 3 == 0 or y % 4 == 0:
                front(im, "body", x, y, shade(a, .85 + .1 * ((x + y) % 2)))
    for part in ("rarm", "larm"):
        for y in range(9):
            for x in range(4):
                if y % 4 == 0 or x % 3 == 0:
                    front(im, part, x, y, shade(a, .9))
    if s.get("pack"):
        overlay_box(im, "body", (0, 0, 0, 0))
        back(im, "body", 1, 1, rgb(s["pack"]), True, 6, 8)
        back(im, "body", 1, 5, shade(rgb(s["pack"]), .7), True, 6, 1)
        back(im, "body", 3, 3, rgb("#e8d9a8"), True, 2, 2)


def fx_armor(im, s):
    m = rgb(s["metal"]); t = rgb(s["team"])
    front(im, "body", 0, 0, shade(m, 1.0), True, 8, 7); front(im, "body", 0, 7, shade(m, .8), True, 8, 2)
    front(im, "body", 3, 1, t, True, 2, 5); front(im, "body", 2, 2, t, True, 4, 1)
    back(im, "body", 0, 0, shade(m, .85), True, 8, 9)
    for part in ("rarm", "larm"):
        front(im, part, 0, 0, shade(m, 1.05), True, 4, 3); front(im, part, 0, 3, t, True, 4, 1)
        side(im, part, "right", 0, 0, shade(m, .9), True, 4, 3); side(im, part, "left", 0, 0, shade(m, .9), True, 4, 3)
    for part in ("rleg", "lleg"):
        front(im, part, 0, 0, shade(m, .8), True, 4, 5)
    # helmet visor
    top(im, "head", 0, 0, shade(m, 1.1), True, 8, 8)
    front(im, "head", 0, 0, m, True, 8, 3); front(im, "head", 0, 3, m, True, 1, 3); front(im, "head", 7, 3, m, True, 1, 3)
    front(im, "head", 3, 0, t, True, 2, 2)
    side(im, "head", "right", 0, 0, m, True, 8, 4); side(im, "head", "left", 0, 0, m, True, 8, 4)
    back(im, "head", 0, 0, shade(m, .8), True, 8, 5)


def fx_builder(im, s):
    h = rgb(s["hat"]); v = rgb(s["vest"])
    front(im, "body", 0, 0, v, True, 2, 12); front(im, "body", 6, 0, v, True, 2, 12)
    front(im, "body", 0, 7, rgb("#e9eef5"), True, 8, 1)
    back(im, "body", 0, 0, v, True, 8, 12); back(im, "body", 0, 7, rgb("#e9eef5"), True, 8, 1)
    front(im, "body", 0, 9, rgb("#6b4a2b"), True, 8, 1); front(im, "body", 5, 9, rgb("#9aa4b5"), True, 2, 3)
    top(im, "head", 0, 0, h, True, 8, 8)
    front(im, "head", 0, 0, h, True, 8, 2); front(im, "head", 0, 2, shade(h, .75), True, 8, 1)
    side(im, "head", "right", 0, 0, h, True, 8, 2); side(im, "head", "left", 0, 0, h, True, 8, 2)
    back(im, "head", 0, 0, h, True, 8, 2); front(im, "head", 3, 0, shade(h, 1.25), True, 2, 1)
    for part in ("rleg", "lleg"):
        front(im, part, 0, 4, rgb("#d9b24a"), True, 4, 1)


def fx_cute(im, s):
    e = rgb(s["ear"]); i = rgb(s.get("inner", "#f2a7bd")); hd = rgb(s["hood"])
    # cat ears on the hat layer
    for ox in (0, 5):
        top(im, "head", ox, 0, e, True, 3, 2); top(im, "head", ox + 1, 0, i, True, 1, 1)
        front(im, "head", ox, 0, e, True, 3, 2); front(im, "head", ox + 1, 0, i, True, 1, 1)
    top(im, "head", 0, 0, shade(rgb(s["hair"]), 1.05), True, 8, 2)
    front(im, "body", 0, 0, hd, True, 8, 3); front(im, "body", 3, 5, shade(hd, .85), True, 2, 3)
    front(im, "body", 1, 8, rgb("#ffffff"), True, 1, 1); front(im, "body", 2, 9, rgb("#ffffff"), True, 1, 1)
    # tail
    back(im, "body", 5, 8, e, True, 2, 4); back(im, "body", 6, 11, rgb("#ffffff"), True, 1, 1)
    # bigger sparkly eyes
    front(im, "head", 1, 3, rgb("#ffffff"), False, 1, 1)
    front(im, "head", 5, 3, rgb("#ffffff"), False, 1, 1)


def fx_spooky(im, s):
    k = s["kind"]
    if k == "ghost":
        w = rgb("#eef2ff")
        paint_box(im, 0, 0, 8, 8, 8, w, .05)
        for part in ("body", "rarm", "larm", "rleg", "lleg"):
            (u, vv, bw, bh, d) = PARTS[part][0]; paint_box(im, u, vv, bw, bh, d, w, .05)
        front(im, "head", 1, 3, rgb("#10131f"), False, 2, 2); front(im, "head", 5, 3, rgb("#10131f"), False, 2, 2); front(im, "head", 3, 6, rgb("#10131f"), False, 2, 2)
    elif k == "pumpkin":
        o = rgb("#e8801c"); paint_box(im, 0, 0, 8, 8, 8, o, .1)
        for x, y in ((1, 3), (2, 3), (5, 3), (6, 3)):
            front(im, "head", x, y, rgb("#ffd34a"), False, 1, 1); front(im, "head", x, y - 1, rgb("#1a0d00"), False, 1, 1)
        front(im, "head", 2, 6, rgb("#1a0d00"), False, 4, 1); front(im, "head", 3, 5, rgb("#ffd34a"), False, 2, 1)
        top(im, "head", 3, 0, rgb("#4a7a2b"), True, 2, 3)
    elif k == "skeleton":
        b = rgb("#dfe3e8")
        for part in ("head", "body", "rarm", "larm", "rleg", "lleg"):
            (u, vv, bw, bh, d) = PARTS[part][0]; paint_box(im, u, vv, bw, bh, d, b, .08)
        front(im, "head", 1, 3, rgb("#12161f"), False, 2, 2); front(im, "head", 5, 3, rgb("#12161f"), False, 2, 2)
        front(im, "head", 2, 6, rgb("#12161f"), False, 4, 1)
        for y in (1, 4, 7):
            front(im, "body", 1, y, rgb("#12161f"), False, 6, 1)
        front(im, "body", 3, 0, rgb("#12161f"), False, 2, 12)
    elif k == "vampire":
        c = rgb("#6b0f1f")
        front(im, "body", 0, 0, c, True, 8, 3); front(im, "body", 0, 0, shade(c, 1.4), True, 1, 3); front(im, "body", 7, 0, shade(c, 1.4), True, 1, 3)
        back(im, "body", 0, 0, c, True, 8, 12); back(im, "body", 0, 0, shade(c, .7), True, 8, 12)
        front(im, "head", 2, 7, rgb("#ffffff"), False, 1, 1); front(im, "head", 5, 7, rgb("#ffffff"), False, 1, 1)
        front(im, "head", 1, 4, rgb("#ff2d3d")); front(im, "head", 6, 4, rgb("#ff2d3d"))
    elif k == "witch":
        h = rgb("#3b1c63")
        top(im, "head", 0, 0, h, True, 8, 8); front(im, "head", 0, 0, h, True, 8, 2); front(im, "head", 0, 2, shade(h, .7), True, 8, 1)
        side(im, "head", "right", 0, 0, h, True, 8, 3); side(im, "head", "left", 0, 0, h, True, 8, 3); back(im, "head", 0, 0, h, True, 8, 3)
        front(im, "head", 3, 0, rgb("#ffd34a"), True, 2, 1)
        front(im, "body", 0, 0, rgb("#2c1550"), True, 8, 12); front(im, "body", 0, 8, shade(rgb("#2c1550"), 1.4), True, 8, 1)
    elif k == "zombie":
        g = rgb("#5f8f4e"); paint_box(im, 0, 0, 8, 8, 8, g, .08)
        for part in ("rarm", "larm"):
            (u, vv, bw, bh, d) = PARTS[part][0]; paint_box(im, u, vv, bw, bh, d, g, .08)
        front(im, "head", 1, 4, rgb("#1b2a1b"), False, 2, 1); front(im, "head", 5, 4, rgb("#1b2a1b"), False, 2, 1)
        front(im, "head", 2, 6, rgb("#2d3f26"), False, 4, 1); front(im, "head", 6, 1, rgb("#3b5a30"), False, 1, 2)
    elif k == "moth":
        c = rgb("#2b2540"); paint_box(im, 0, 0, 8, 8, 8, rgb("#c9b9a6"), .06)
        top(im, "head", 0, 0, c, True, 8, 8); front(im, "head", 0, 0, c, True, 8, 3)
        front(im, "head", 1, 3, rgb("#ffd34a"), False, 2, 1); front(im, "head", 5, 3, rgb("#ffd34a"), False, 2, 1)
        back(im, "body", 0, 0, c, True, 8, 12)
        for x in range(8):
            back(im, "body", x, x % 3, rgb("#7d6aa8"), True, 1, 1)


def fx_minimal(im, s):
    a = rgb(s["accent"])
    front(im, "body", 3, 0, a, True, 2, 12)
    front(im, "rarm", 0, 0, a, True, 4, 1) if False else None


ARCH = {"flannel": fx_flannel, "armor": fx_armor, "builder": fx_builder, "cute": fx_cute, "spooky": fx_spooky, "minimal": fx_minimal}


def S(id, name, cat, desc, fx, **kw):
    kw.setdefault("skin", "#e9b48a"); kw.setdefault("hair", "#3b2a1c"); kw.setdefault("shirt", "#4a6fa5")
    kw.setdefault("pants", "#2c3a55"); kw.setdefault("shoes", "#1c1f2a")
    return dict(id=id, name=name, cat=cat, desc=desc, fx=ARCH[fx], **kw)


SKINS = [
    # survival
    S("trailhand", "Trailhand", "survival", "Red flannel, day pack, ready for the first night.", "flannel", accent="#b8412f", shirt="#8f3324", hair="#4a2f1b", pack="#6b5a3a", pants="#35435e", shoes="#4b3320"),
    S("quarry-mira", "Quarry Mira", "survival", "Green plaid with a long braid-brown bob.", "flannel", accent="#2f7d57", shirt="#245f43", hair="#5a3a22", hairstyle="bob", pants="#3d3a33", shoes="#3a2a1c", skin="#d9a07a"),
    S("cabin-dweller", "Cabin Dweller", "survival", "Mustard check, grey beanie-free scruff.", "flannel", accent="#d7a43a", shirt="#a67c25", hair="#2b2b30", hairstyle="buzz", pack="#4c5a3a", pants="#2d3441", shoes="#2b2218", skin="#c68863"),
    S("deep-miner", "Deep Miner", "survival", "Slate blue work shirt for the 12th hour underground.", "flannel", accent="#5a78b8", shirt="#3e5a8f", hair="#1d1d22", hairstyle="short", pack="#8a6b3b", pants="#4a4034", shoes="#2a1f15", skin="#8d5a3b"),
    S("harvest-moon", "Harvest Moon", "survival", "Farmer's orange check and a sun-bleached fringe.", "flannel", accent="#e08a2e", shirt="#b0661c", hair="#d6b370", hairstyle="fringe", pants="#4a5d7a", shoes="#5a3a22", skin="#f0c4a0"),
    S("tidewalker", "Tidewalker", "survival", "Teal fisher's smock, salt-streaked hair.", "flannel", accent="#37a3a3", shirt="#26797a", hair="#8a8f99", hairstyle="long", pack="#556b73", pants="#2a3340", shoes="#222a33", skin="#e2b08a"),
    S("snowline", "Snowline", "survival", "Pale parka check for the tundra run.", "flannel", accent="#cfd9ea", shirt="#8d9bb8", hair="#e8e0d0", hairstyle="short", pack="#a14b3a", pants="#2f3a4d", shoes="#262a33", skin="#f3d2b8"),
    S("ashfall", "Ashfall", "survival", "Charcoal check with an ember stripe. Nether-ready.", "flannel", accent="#d9552b", shirt="#3a3238", hair="#14110f", hairstyle="spiky", pants="#25232b", shoes="#18141a", skin="#b9805a"),
    # pvp
    S("vanguard", "Vanguard", "pvp", "Steel plate, blue crest. The default duel skin.", "armor", metal="#aeb8c8", team="#3b6cf0", hair="#2a1e14", skin="#e0a982", shirt="#33406a", pants="#232b45"),
    S("crimson-guard", "Crimson Guard", "pvp", "Red crest on gunmetal. Reads as a team colour at 30 blocks.", "armor", metal="#6a707e", team="#d93a3a", hair="#1a1a1a", skin="#d1996f", shirt="#4a2428", pants="#2a1c22"),
    S("emerald-knight", "Emerald Knight", "pvp", "Green crest, brushed steel.", "armor", metal="#b9c3cf", team="#2fbf71", hair="#6a4a2a", skin="#e9b48a", shirt="#1f4a3a", pants="#1c2f2a"),
    S("gold-rush", "Gold Rush", "pvp", "Polished gold plate; loud on purpose.", "armor", metal="#d9b13a", team="#7a4a1c", hair="#2b1d12", skin="#d9a07a", shirt="#5a4720", pants="#3a2f18"),
    S("void-runner", "Void Runner", "pvp", "Black plate with a violet crest. Low-contrast, high-attitude.", "armor", metal="#2a2e3a", team="#9a5af0", hair="#e8e8f0", skin="#cfa07c", shirt="#161923", pants="#10121a"),
    S("frostbite", "Frostbite", "pvp", "Ice-white plate, cyan crest.", "armor", metal="#e2ecf7", team="#35c2e8", hair="#1d2a3a", skin="#f0cfae", shirt="#5a7a99", pants="#34506a"),
    S("rust-lord", "Rust Lord", "pvp", "Weathered orange iron.", "armor", metal="#9a5a34", team="#e8b13a", hair="#201a16", skin="#b27650", shirt="#4a3426", pants="#2c2420"),
    S("midnight-duelist", "Midnight Duelist", "pvp", "Navy plate with a white crest for dark arenas.", "armor", metal="#27324f", team="#f2f5ff", hair="#0f1220", skin="#e5b48e", shirt="#1a2240", pants="#121830"),
    # builder
    S("foreman-flint", "Foreman Flint", "builder", "Orange hard hat, hi-vis vest, tool belt.", "builder", hat="#f08a1c", vest="#e8d02a", shirt="#3d4a63", hair="#3a2a1c", pants="#40495c", shoes="#4a3a28"),
    S("architect-ines", "Architect Ines", "builder", "White hat, lime vest. Draws before she digs.", "builder", hat="#eef0f3", vest="#9be23a", shirt="#2c3e50", hair="#1c1410", hairstyle="bob", pants="#2c3442", skin="#c68863"),
    S("redstone-rae", "Redstone Rae", "builder", "Red hat, graphite overalls, wiring-grey gloves.", "builder", hat="#d83a32", vest="#f08a1c", shirt="#4a1f1f", hair="#6a3a1a", hairstyle="fringe", pants="#33343c", skin="#f0c4a0"),
    S("quartz-crew", "Quartz Crew", "builder", "Clean-room white; for builds that ought to look clean.", "builder", hat="#f5f7fa", vest="#cfd8e3", shirt="#8a96a8", hair="#2a2e38", pants="#566074", skin="#e5b48e"),
    S("sandstone-sam", "Sandstone Sam", "builder", "Desert tones and a lemon hat.", "builder", hat="#f2d04a", vest="#d98a3a", shirt="#a6824a", hair="#3a281a", pants="#5a4a33", skin="#b9805a"),
    S("blueprint-bo", "Blueprint Bo", "builder", "Cyan hat, navy shirt.", "builder", hat="#34b6e8", vest="#e8d02a", shirt="#1f3a6a", hair="#c9c9d0", hairstyle="buzz", pants="#2a3046", skin="#8d5a3b"),
    S("terra-tess", "Terra Tess", "builder", "Earthy greens for landscapers.", "builder", hat="#5a9a3a", vest="#e8d02a", shirt="#3a5a33", hair="#7a4a22", hairstyle="long", pants="#3a3a2c", skin="#f0c4a0"),
    S("copperhead", "Copperhead", "builder", "Copper hat, teal shirt (it will oxidise, we promise).", "builder", hat="#c8703a", vest="#37a38f", shirt="#24655a", hair="#2a1a14", pants="#2f3a3a", skin="#d9a07a"),
    # cute
    S("mochi", "Mochi", "cute", "White cat ears, pink hoodie, tail included.", "cute", ear="#f4f1ee", hood="#f08aa8", hair="#f4f1ee", shirt="#f4a0b8", pants="#6a6f9a", shoes="#f4f1ee", skin="#f6d3bc", blush=True, hairstyle="bob"),
    S("sprout", "Sprout", "cute", "Mint hoodie, leaf-green hair.", "cute", ear="#8fd19e", hood="#5fb882", hair="#8fd19e", shirt="#7fd1a0", pants="#4a6a5a", shoes="#e8f2ea", skin="#f6d3bc", blush=True, hairstyle="fringe"),
    S("pudding", "Pudding", "cute", "Butter-yellow hoodie, cream ears.", "cute", ear="#fff0b8", hood="#f2cf5a", hair="#e8c27a", shirt="#f5dd7a", pants="#8a6a4a", shoes="#fff7e0", skin="#f3d2b8", blush=True, hairstyle="bob"),
    S("blueberry", "Blueberry", "cute", "Periwinkle everything.", "cute", ear="#9db4f2", hood="#6f8de0", hair="#44508a", shirt="#8aa3ec", pants="#3a4270", shoes="#e8ecff", skin="#f6d3bc", blush=True, hairstyle="long"),
    S("ember-kit", "Ember Kit", "cute", "Orange fox-cat, cream socks.", "cute", ear="#f08a2e", hood="#e8741c", hair="#e8741c", shirt="#f2923a", pants="#5a3a2a", shoes="#fff0dc", skin="#f6d3bc", blush=True, hairstyle="fringe", inner="#fff0dc"),
    S("lilac", "Lilac", "cute", "Lavender hoodie, dark ears.", "cute", ear="#3a3550", hood="#b49af0", hair="#3a3550", shirt="#c4aef5", pants="#4a4470", shoes="#f1ecff", skin="#f6d3bc", blush=True, hairstyle="bob", inner="#d9c9ff"),
    S("cocoa", "Cocoa", "cute", "Brown cat, cream hoodie.", "cute", ear="#6a4a33", hood="#e8d9c0", hair="#6a4a33", shirt="#f0e4cf", pants="#7a5a43", shoes="#6a4a33", skin="#d9a07a", blush=True, hairstyle="short"),
    S("bubblegum", "Bubblegum", "cute", "Hot pink with a cyan fringe.", "cute", ear="#ff6fa8", hood="#ff4f94", hair="#35d0e8", shirt="#ff8cba", pants="#5a4a8a", shoes="#ffffff", skin="#f6d3bc", blush=True, hairstyle="fringe", inner="#ffd1e4"),
    # spooky
    S("casper", "Casper", "spooky", "A bedsheet ghost. Good at hide and seek.", "spooky", kind="ghost"),
    S("jack", "Jack", "spooky", "Jack-o'-lantern head, no questions.", "spooky", kind="pumpkin", shirt="#2a2030", pants="#1c1822", skin="#e8801c"),
    S("rattle", "Rattle", "spooky", "Bare bones and a ribcage stripe.", "spooky", kind="skeleton"),
    S("count-vesper", "Count Vesper", "spooky", "Red-lined collar, fangs, red eyes.", "spooky", kind="vampire", skin="#e8dcd2", hair="#0f0d14", hairstyle="fringe", shirt="#1a1620", pants="#14101a"),
    S("hex", "Hex", "spooky", "Violet witch hat and robe.", "spooky", kind="witch", skin="#9fc78a", hair="#2a1a3a", hairstyle="long", shirt="#2c1550", pants="#1c1030", shoes="#0f0a1a"),
    S("shamble", "Shamble", "spooky", "Friendly neighbourhood zombie, torn shirt.", "spooky", kind="zombie", shirt="#3b5a8a", pants="#2b3a5a", hair="#2b3a26", hairstyle="short"),
    S("mothman", "Mothman", "spooky", "Dusty moth with lantern eyes.", "spooky", kind="moth", shirt="#2b2540", pants="#1e1a30", hair="#2b2540", hairstyle="none"),
    S("graveyard-shift", "Graveyard Shift", "spooky", "Hooded witch-adjacent with a gold clasp.", "spooky", kind="witch", skin="#c9d6c0", hair="#cfcfd8", hairstyle="long", shirt="#222a3a", pants="#161b28", shoes="#0e121c"),
    # minimal
    S("mono-light", "Mono Light", "minimal", "One white shirt, one blue stripe. Nothing else.", "minimal", accent="#3b6cf0", shirt="#f1f4fa", pants="#c5ccdc", shoes="#e8ecf5", hair="#2a2e38", hairstyle="short"),
    S("mono-dark", "Mono Dark", "minimal", "Black on black on blue.", "minimal", accent="#8fb4ff", shirt="#14171f", pants="#0d0f15", shoes="#080a0e", hair="#0a0b10", hairstyle="short"),
    S("pastel-1", "Pastel One", "minimal", "Soft peach, soft sky.", "minimal", accent="#f2a7bd", shirt="#f8d9c8", pants="#a9c4ea", shoes="#ffffff", hair="#8a5a3a", hairstyle="bob"),
    S("signal", "Signal", "minimal", "Safety orange, grey trousers; easy to find in a crowd.", "minimal", accent="#ffffff", shirt="#f2762a", pants="#4a505e", shoes="#20242c", hair="#1a1410", hairstyle="buzz"),
    S("fern", "Fern", "minimal", "Two greens.", "minimal", accent="#d6f0c8", shirt="#4a8f5a", pants="#2c4a38", shoes="#1c2c22", hair="#3a2a1c", hairstyle="fringe"),
    S("ink", "Ink", "minimal", "Navy with a single cyan seam.", "minimal", accent="#35c2e8", shirt="#1b2a4a", pants="#121c34", shoes="#0c1224", hair="#0c1224", hairstyle="short"),
    S("rose-gold", "Rose Gold", "minimal", "Warm metallic pink, flat-shaded.", "minimal", accent="#fbe4d6", shirt="#d9958f", pants="#8a5a63", shoes="#5a3a42", hair="#5a3a2a", hairstyle="long"),
    S("steel", "Steel", "minimal", "Cool greys and nothing to distract.", "minimal", accent="#e8edf5", shirt="#7a8498", pants="#4a5266", shoes="#2a3040", hair="#2b2f38", hairstyle="short"),
]


# ---- capes ---------------------------------------------------------------------------------------------------------
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
    man = {"generator": "tools/make_skin_library.py", "licence": "CC0-1.0", "skins": [], "capes": []}
    for s in SKINS:
        im = build(dict(s))
        png(os.path.join(SK, s["id"] + ".png"), 64, 64, im.px)
        man["skins"].append({"id": s["id"], "name": s["name"], "category": s["cat"], "description": s["desc"], "file": f"library/skins/{s['id']}.png", "model": "classic", "author": "Luminos (generated)", "licence": "CC0-1.0", "source": "tools/make_skin_library.py"})
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
    rows += [f"| {s['id']} | skin | {s['category']} | Luminos (generated) | CC0-1.0 | tools/make_skin_library.py |" for s in man["skins"]]
    rows += [f"| {c['id']} | cape{' (animated, ' + str(c['frames']) + ' frames)' if c['animated'] else ''} | - | Luminos (generated) | CC0-1.0 | tools/make_skin_library.py |" for c in man["capes"]]
    with open(os.path.join(ROOT, "docs", "research", "LIBRARY_ATTRIBUTION.md"), "w") as f:
        f.write("\n".join(rows) + "\n")
    print(len(SKINS), "skins", len(CAPES), "capes")


if __name__ == "__main__":
    main()
