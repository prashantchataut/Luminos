#!/usr/bin/env python3
"""The five Luminos skins. Painted from scratch, pixel by pixel; no template, no scraped or traced art.

Writes, for each skin: launcher/crates/luminos-core/assets/skins/<id>.png (built into the engine),
app/public/skins/<id>.png (the launcher UI), and app/src/data/skins.json (the manifest).
Licence: CC0-1.0. Run: python3 tools/make_luminos_skins.py
"""
import json, os, random, struct, zlib

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def hx(h, a=255):
    h = h.lstrip("#")
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), a)


def sh(c, k):  # k > 0 lightens, k < 0 darkens
    if k >= 0:
        return tuple(min(255, int(v + (255 - v) * k)) for v in c[:3]) + (c[3],)
    return tuple(max(0, int(v * (1 + k))) for v in c[:3]) + (c[3],)


def mix(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3)) + (255,)


class Img:
    def __init__(self):
        self.px = [(0, 0, 0, 0)] * (64 * 64)

    def set(self, x, y, c):
        if 0 <= x < 64 and 0 <= y < 64:
            self.px[y * 64 + x] = c

    def get(self, x, y):
        return self.px[y * 64 + x]


def png(path, im):
    raw = b"".join(b"\x00" + b"".join(bytes(im.px[y * 64 + x]) for x in range(64)) for y in range(64))

    def chunk(t, d):
        c = struct.pack(">I", len(d)) + t + d
        return c + struct.pack(">I", zlib.crc32(t + d) & 0xFFFFFFFF)

    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "wb") as f:
        f.write(b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", 64, 64, 8, 6, 0, 0, 0)) + chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b""))


def faces(ox, oy, w, h, d):
    return {"top": (ox + d, oy, w, d), "bottom": (ox + d + w, oy, w, d), "right": (ox, oy + d, d, h), "front": (ox + d, oy + d, w, h),
            "left": (ox + d + w, oy + d, d, h), "back": (ox + 2 * d + w, oy + d, w, h)}


def layout(slim):
    aw = 3 if slim else 4
    return {"head": (0, 0, 8, 8, 8), "hat": (32, 0, 8, 8, 8), "body": (16, 16, 8, 12, 4), "jacket": (16, 32, 8, 12, 4),
            "rarm": (40, 16, aw, 12, 4), "rsleeve": (40, 32, aw, 12, 4), "larm": (32, 48, aw, 12, 4), "lsleeve": (48, 48, aw, 12, 4),
            "rleg": (0, 16, 4, 12, 4), "rpant": (0, 32, 4, 12, 4), "lleg": (16, 48, 4, 12, 4), "lpant": (0, 48, 4, 12, 4)}


def paint(im, slim, part, fn):
    """fn(face, x, y, w, h) -> colour or None, with x, y local to the face."""
    for name, (fx, fy, fw, fh) in faces(*layout(slim)[part]).items():
        for y in range(fh):
            for x in range(fw):
                c = fn(name, x, y, fw, fh)
                if c is not None:
                    im.set(fx + x, fy + y, c)


# ---------------------------------------------------------------- head, shared by all five (each passes its own masks and colours)
FRONT = {
    "short": ["HHHHHHHH", "HHHHHHHH", "HSSSSSSH", "SbbSSbbS", "SweSSewS", "SSSnnSSS", "SSSmmSSS", "SSSSSSSS"],
    "side":  ["HHHHHHHH", "HHHHHHHH", "HHSSSSHH", "HSbSSbSH", "HweSSewH", "SSSnnSSS", "SSSmmSSS", "SSSSSSSS"],
    "fringe": ["HHHHHHHH", "HHHHHHHH", "HHHSSHHH", "SbbSSbbS", "SweSSewS", "SSSnnSSS", "SSSmmSSS", "SSSSSSSS"],
    "dot":   ["HHHHHHHH", "HHHHHHHH", "HSSSSSSH", "SSSSSSSS", "SSeSSeSS", "SSSnnSSS", "SSSSSSSS", "SSSSSSSS"],
}
SIDE = {  # right face (front edge at x = 7); the left face is this mirrored
    "short": ["HHHHHHHH", "HHHHHHHH", "HHHSSSSS", "HHSSSSSS", "SSSEESSS", "SSSEESSS", "SSSSSSSS", "SSSSSSSS"],
    "long":  ["HHHHHHHH", "HHHHHHHH", "HHHHSSSS", "HHHSSSSS", "HHSEESSS", "HHSEESSS", "HHHSSSSS", "HHSSSSSS"],
}


def head(im, slim, skin, hair, hair2, eye, white, mouth, front="short", side="short", back_long=False, brow=None):
    pal = {"H": hair, "S": skin, "e": eye, "w": white, "b": brow or hair, "m": mouth, "n": sh(skin, -0.09), "E": sh(skin, -0.14)}
    fm, sm = FRONT[front], SIDE[side]
    rng = random.Random(hair[0] * 7 + hair[2] + len(front))

    def base(face, x, y, w, h):
        if face == "front":
            c = pal[fm[y][x]]
            return hair2 if (c == hair and rng.random() < 0.2) else c
        if face in ("right", "left"):
            c = pal[sm[y][x if face == "right" else 7 - x]]
            return hair2 if (c == hair and (x * 3 + y) % 5 == 0) else c
        if face == "back":
            if y < 6 or back_long:
                return hair if (x + y * 2) % 6 else hair2
            return sh(skin, -0.05)
        if face == "top":
            return hair if (x + y) % 4 else hair2
        return sh(skin, -0.12)
    paint(im, slim, "head", base)

    def hat(face, x, y, w, h):  # outer layer: hair volume, tufts at the edges, nothing over the face
        if face == "top":
            return sh(hair, 0.06) if (x * 5 + y * 3) % 7 else hair2
        if face == "front":
            return sh(hair, 0.05) if (y < 2 and (x + y) % 2 == 0) else (hair if y < 1 else None)
        if face == "right":
            return hair if (y < 3 and x < 5) or (back_long and y < 7 and x < 2) else None
        if face == "left":
            return hair if (y < 3 and x > 2) or (back_long and y < 7 and x > 5) else None
        if face == "back":
            return hair if y < 7 else None
        return None
    paint(im, slim, "hat", hat)


# ---------------------------------------------------------------- 1. Luminos Default (classic): navy and off-white, crescent on the back
def luminos_default():
    im = Img()
    navy, deep, mid, off, skin = hx("#14213d"), hx("#0b1530"), hx("#26407a"), hx("#eef1f7"), hx("#d9a982")
    head(im, False, skin, deep, mid, hx("#3b6cf0"), off, hx("#a8734f"), front="short", side="short")

    def body(f, x, y, w, h):
        c = navy
        if f in ("front", "back") and y == 0:
            c = off
        elif f == "front" and x == 3:
            c = off                                    # zip
        elif f in ("front", "back") and y == 5:
            c = mid                                    # panel line
        elif y == h - 1:
            c = deep
        return sh(c, -0.06 if y > 7 else 0)
    paint(im, False, "body", body)
    crescent = ["..XXX..", ".XX....", "XX.....", "XX.....", "XX...S.", ".XX....", "..XXX.."]

    def jacket(f, x, y, w, h):  # outer layer: collar band, hem band, and the mark on the back
        if y == 0 and f in ("front", "back", "left", "right"):
            return sh(off, -0.05)
        if y >= h - 2:
            return mid
        if f == "back" and 2 <= y < 9 and x < 7:
            ch = crescent[y - 2][x]
            if ch == "X":
                return off
            if ch == "S":
                return hx("#8fb4ff")
        return None
    paint(im, False, "jacket", jacket)

    def arm(f, x, y, w, h):
        if y >= 10:
            return skin if f != "top" else navy
        if y in (8, 9):
            return off
        return navy if y > 0 else mid
    for p in ("rarm", "larm"):
        paint(im, False, p, arm)
    for p in ("rsleeve", "lsleeve"):
        paint(im, False, p, lambda f, x, y, w, h: mix(navy, mid, 0.5) if y < 2 and f != "bottom" else None)

    def leg(f, x, y, w, h):
        if y == 11:
            return off
        if y >= 9:
            return mid
        return sh(deep, 0.04 if f == "front" else -0.04)
    for p in ("rleg", "lleg"):
        paint(im, False, p, leg)
    for p, side in (("rpant", "right"), ("lpant", "left")):
        paint(im, False, p, lambda f, x, y, w, h, side=side: off if f == side and 1 <= x <= 2 and y < 9 else None)
    return im


# ---------------------------------------------------------------- 2. Ember (slim): rust and charcoal, worn leather
def ember():
    im = Img()
    rust, drust, char, lchar, stitch, skin = hx("#b4532a"), hx("#8a3d1d"), hx("#2b2b2e"), hx("#3d3d42"), hx("#d98b57"), hx("#c68a60")
    rng = random.Random(41)

    def leather(base, x, y):  # worn: per-pixel grain, creases, and scuffed patches
        r = rng.random()
        c = sh(base, (rng.random() - 0.5) * 0.18)
        if r < 0.07:
            c = sh(drust, rng.random() * 0.1)
        elif r < 0.11:
            c = sh(stitch, -0.15)
        if (x * 7 + y * 5) % 11 == 0 and y % 3:
            c = sh(c, -0.18)
        return c
    head(im, True, skin, char, drust, hx("#f0a24a"), hx("#f4e6d4"), hx("#8f5a3a"), front="fringe", side="short")
    for x, y in ((9, 13), (10, 14), (13, 14), (14, 13)):
        im.set(x, y, sh(skin, -0.1))                    # freckles

    def body(f, x, y, w, h):  # charcoal shirt with a rust v-neck and a belt
        if f == "front" and y < 3 and abs(x - 3.5) < 3 - y:
            return sh(drust, -0.1)
        if y >= h - 2:
            return stitch if (f == "front" and x in (3, 4) and y == h - 2) else lchar
        return sh(char, 0.03 if (x + y) % 2 else 0)
    paint(im, True, "body", body)

    def jacket(f, x, y, w, h):  # leather jacket, open at the front
        if f == "front":
            if x in (3, 4) and y >= 1:
                return None
            if y < 3 and x in (2, 5):
                return sh(char, 0.08)                   # lapel edge
        if f == "back" and y == 4:
            return sh(drust, -0.1)                      # yoke seam
        if f == "back" and y == 8 and 2 <= x <= 5:
            return stitch
        if y == h - 1:
            return sh(drust, -0.05)
        return leather(rust, x, y)
    paint(im, True, "jacket", jacket)

    def arm(f, x, y, w, h):
        if y >= 10:
            return char
        if y in (8, 9):
            return lchar
        return leather(rust, x, y)
    for p in ("rarm", "larm"):
        paint(im, True, p, arm)

    def sleeve(f, x, y, w, h):
        if y > 7:
            return None
        if y in (3, 4) and f in ("left", "right", "back"):
            return sh(drust, -0.05 + rng.random() * 0.1)  # elbow patch
        return leather(rust, x, y)
    for p in ("rsleeve", "lsleeve"):
        paint(im, True, p, sleeve)

    def leg(f, x, y, w, h):
        if y >= 8:
            return sh(drust, -0.12 + (0.06 if y == 8 else 0))   # boots
        if f == "front" and y in (3, 4) and x in (1, 2):
            return sh(char, 0.14)                               # knee patch
        return sh(char, 0.02 if (x + y) % 3 == 0 else 0)
    for p in ("rleg", "lleg"):
        paint(im, True, p, leg)
    for p in ("rpant", "lpant"):
        paint(im, True, p, lambda f, x, y, w, h: leather(rust, x, y) if (y in (7, 8) and f not in ("top", "bottom")) else (stitch if (y == 9 and f == "front" and x in (0, 3)) else None))
    return im


# ---------------------------------------------------------------- 3. Glasshouse (classic): mint and white, botanical back
def glasshouse():
    im = Img()
    mint, dmint, white, leaf, stem, skin = hx("#b9e6d0"), hx("#7cc4a2"), hx("#f7fbf9"), hx("#3f8f6b"), hx("#2d6b50"), hx("#f0c9a8")
    head(im, False, skin, hx("#e4f3ea"), hx("#c9e6d6"), leaf, white, hx("#c98a78"), front="side", side="long", back_long=True, brow=hx("#9fc9b4"))
    for k in range(2):
        im.set(32 + 16 + 1, 8 + 3 + k, leaf)            # leaf clip on the hat layer, left side
    im.set(32 + 16 + 2, 8 + 3, stem)

    def body(f, x, y, w, h):
        if f == "front" and y < 2 and 2 <= x <= 5:
            return sh(skin, -0.02)                      # neckline
        return white if (x + y) % 5 else sh(white, -0.03)
    paint(im, False, "body", body)

    def sx(y):
        return 3 if y % 4 < 2 else 4

    def jacket(f, x, y, w, h):  # outer layer: a mint over-shirt; the back carries the vine
        if f == "front" and x in (3, 4) and y >= 1:
            return None
        if y == h - 1:
            return dmint
        c = mint if (x * 3 + y) % 7 else sh(mint, 0.08)
        if f == "back":
            if x == sx(y):
                return stem
            for i, ly in enumerate((2, 5, 8, 10)):
                d = -1 if i % 2 == 0 else 1
                if (x, y) in ((sx(ly) + d, ly), (sx(ly) + 2 * d, ly), (sx(ly) + 2 * d, ly - 1)):
                    return leaf
                if (x, y) == (sx(ly) + 3 * d, ly - 1):
                    return white                        # blossom
        return c
    paint(im, False, "jacket", jacket)

    def arm(f, x, y, w, h):
        if y >= 10:
            return skin
        if y in (8, 9):
            return mint
        return white
    for p in ("rarm", "larm"):
        paint(im, False, p, arm)
    for p in ("rsleeve", "lsleeve"):
        paint(im, False, p, lambda f, x, y, w, h: mint if 2 <= y <= 5 and f not in ("top", "bottom") else None)

    def leg(f, x, y, w, h):
        if y >= 10:
            return white
        return dmint if y == 9 else (mint if (x + y) % 6 else sh(mint, 0.07))
    for p in ("rleg", "lleg"):
        paint(im, False, p, leg)
    for p, side in (("rpant", "right"), ("lpant", "left")):  # a small sprig on each outer thigh
        paint(im, False, p, lambda f, x, y, w, h, side=side: (stem if (x, y) == (1, 4) else leaf) if (f == side and (x, y) in ((1, 3), (2, 4), (1, 5), (2, 2), (1, 4))) else None)
    return im


# ---------------------------------------------------------------- 4. Nightshift (slim): black and violet, gradient sleeves
def nightshift():
    im = Img()
    blk, nblk, vio, bvio, dvio, skin = hx("#0a0a0f"), hx("#14141c"), hx("#6d3fd9"), hx("#9b6bff"), hx("#3a1f7a"), hx("#b98a6b")
    head(im, True, skin, blk, nblk, hx("#c3a3ff"), hx("#e9e0ff"), hx("#8a5c48"), front="fringe", side="short")
    for x in (5, 6):
        im.set(8 + x, 8 + 1, bvio)                     # violet streak in the fringe
    im.set(8 + 6, 8 + 2, vio)

    def body(f, x, y, w, h):
        if f == "front" and x in (2, 5) and 1 <= y <= 4:
            return vio if y < 4 else bvio               # drawstrings
        if y >= h - 2:
            return dvio
        return nblk if (x + y) % 2 else blk
    paint(im, True, "body", body)

    def jacket(f, x, y, w, h):  # outer layer: hood rim at the neck, hem trim
        if y == 0 and f in ("front", "back", "left", "right"):
            return nblk
        if y == 1 and f == "back" and 1 <= x <= 6:
            return blk
        if y == h - 1:
            return vio
        return None
    paint(im, True, "jacket", jacket)

    def arm(f, x, y, w, h):  # a gradient that stops short of full violet on the base layer
        if y >= 10:
            return skin
        if f in ("top", "bottom"):
            return nblk
        return mix(nblk, vio, min(1.0, y / 9) * 0.85)
    for p in ("rarm", "larm"):
        paint(im, True, p, arm)
    for p in ("rsleeve", "lsleeve"):  # outer layer: a faint violet wash that grows toward the cuff
        paint(im, True, p, lambda f, x, y, w, h: None if (y < 4 or f in ("top", "bottom")) else mix(nblk, bvio, (y - 3) / 9 * 0.55))

    def leg(f, x, y, w, h):
        if y >= 10:
            return vio if y == 11 else blk
        if f in ("left", "right") and x == 1:
            return vio
        return sh(blk, 0.04 if (x + y) % 2 else 0)
    for p in ("rleg", "lleg"):
        paint(im, True, p, leg)
    for p in ("rpant", "lpant"):
        paint(im, True, p, lambda f, x, y, w, h: nblk if (y in (7, 8) and f not in ("top", "bottom")) else None)
    return im


# ---------------------------------------------------------------- 5. Paper (classic): cream and ink, line art
def paper():
    im = Img()
    cream, dcream, ink, link, skin = hx("#f3ead6"), hx("#e0d3b4"), hx("#1f2430"), hx("#4a5163"), hx("#ecd0b0")
    head(im, False, skin, ink, link, ink, cream, hx("#9a6f58"), front="dot", side="short")
    peaks = {(0, 8), (1, 7), (2, 6), (3, 7), (4, 5), (5, 4), (6, 5), (7, 6)}  # a line of two peaks across the chest
    bird = {(1, 4), (2, 3), (3, 4), (4, 4), (5, 3), (6, 4), (3, 5), (4, 5), (3, 6), (4, 7)}

    def body(f, x, y, w, h):
        if f == "front":
            if (x, y + 1) in peaks or (x, y) == (6, 2):  # peaks, and a small sun
                return ink
            if y == 0 and x in (3, 4):
                return dcream
        if f == "back" and (x, y) in bird:
            return ink
        if f in ("front", "back") and y == h - 1:
            return ink                                   # hem line
        return cream if (x * 7 + y * 3) % 9 else sh(cream, -0.03)
    paint(im, False, "body", body)

    def jacket(f, x, y, w, h):  # outer layer: a pencil-thin outline of a coat, no fill
        if f in ("front", "back") and x in (0, w - 1) and y > 0:
            return link
        if y == 0 and f != "bottom":
            return link
        return None
    paint(im, False, "jacket", jacket)

    def arm(f, x, y, w, h):
        if y >= 10:
            return skin
        if y == 9:
            return ink
        return cream if (x + y) % 5 else sh(cream, -0.03)
    for p in ("rarm", "larm"):
        paint(im, False, p, arm)
    for p in ("rsleeve", "lsleeve"):
        paint(im, False, p, lambda f, x, y, w, h: link if (y in (0, 7) and f not in ("top", "bottom")) else None)

    def leg(f, x, y, w, h):
        if y >= 10:
            return ink
        if f in ("front", "back") and x == 0:
            return link
        return dcream if (x + y) % 6 else sh(dcream, -0.04)
    for p in ("rleg", "lleg"):
        paint(im, False, p, leg)
    for p in ("rpant", "lpant"):
        paint(im, False, p, lambda f, x, y, w, h: link if (y == 8 and f not in ("top", "bottom")) else None)
    return im


SKINS = [
    ("luminos-default", "Luminos Default", "classic", luminos_default, "Dark navy and off-white with panel lines and the Luminos crescent on the back."),
    ("ember", "Ember", "slim", ember, "Worn rust leather over charcoal, stitched cuffs and boots."),
    ("glasshouse", "Glasshouse", "classic", glasshouse, "Mint and white with a vine pattern on the back layer."),
    ("nightshift", "Nightshift", "slim", nightshift, "Black hoodie, violet trim, sleeves that fade toward the cuff."),
    ("paper", "Paper", "classic", paper, "Cream and ink with thin line art."),
]


def validate(im, slim):
    """A real skin has every base-layer face opaque and an outer layer that is only partly filled."""
    lay = layout(slim)
    for part in ("head", "body", "rarm", "larm", "rleg", "lleg"):
        for name, (fx, fy, fw, fh) in faces(*lay[part]).items():
            for y in range(fh):
                for x in range(fw):
                    assert im.get(fx + x, fy + y)[3] == 255, f"hole in {part}.{name} at {x},{y}"
    outer = [im.get(fx + x, fy + y)[3] for part in ("hat", "jacket", "rsleeve", "lsleeve", "rpant", "lpant")
             for (fx, fy, fw, fh) in faces(*lay[part]).values() for y in range(fh) for x in range(fw)]
    filled = sum(1 for a in outer if a) / len(outer)
    assert 0.08 < filled < 0.95, f"outer layer fill {filled:.2f}"
    return filled


def main():
    man = []
    for sid, name, model, fn, desc in SKINS:
        im = fn()
        filled = validate(im, model == "slim")
        for rel in (("launcher", "crates", "luminos-core", "assets", "skins"), ("app", "public", "skins")):
            png(os.path.join(ROOT, *rel, sid + ".png"), im)
        man.append({"id": sid, "name": name, "model": model, "description": desc, "file": f"skins/{sid}.png", "author": "Luminos", "licence": "CC0-1.0", "builtin": True, "outerFill": round(filled, 2)})
        print(f"{sid:16s} {model:8s} outer layer {filled:.0%}")
    with open(os.path.join(ROOT, "app", "src", "data", "skins.json"), "w") as f:
        json.dump(man, f, indent=1)


if __name__ == "__main__":
    main()
