#!/usr/bin/env python3
"""Original Luminos skins + cape (64x64 / 64x32 RGBA PNG). Deterministic, stdlib only.

Everything is drawn here from rectangles and an ordered (Bayer) dither: no Mojang texture is read or reused.
Run:  python3 tools/make_skins.py   -> launcher/crates/luminos-core/assets/skins/*.png
"""
import os
import struct
import zlib

OUT = os.path.join(os.path.dirname(__file__), "..", "launcher", "crates", "luminos-core", "assets", "skins")
BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]


def rgb(h):
    h = h.lstrip("#")
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), 255)


def write_png(path, w, h, px):
    raw = b"".join(b"\x00" + b"".join(bytes(px[y * w + x]) for x in range(w)) for y in range(h))

    def chunk(t, d):
        c = struct.pack(">I", len(d)) + t + d
        return c + struct.pack(">I", zlib.crc32(t + d) & 0xFFFFFFFF)

    data = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 6, 0, 0, 0))
    data += chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b"")
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "wb") as f:
        f.write(data)


class Img:
    def __init__(self, w, h):
        self.w, self.h = w, h
        self.px = [(0, 0, 0, 0)] * (w * h)

    def set(self, x, y, c):
        if 0 <= x < self.w and 0 <= y < self.h and c is not None:
            self.px[y * self.w + x] = c

    def rect(self, x, y, w, h, c):
        for yy in range(y, y + h):
            for xx in range(x, x + w):
                self.set(xx, yy, c)


def dith(a, b, t, x, y):
    """Ordered dither between colours a (t=0) and b (t=1)."""
    return b if (BAYER[y % 4][x % 4] + 0.5) / 16.0 < t else a


def box(img, u, v, w, h, d, paint):
    """Paint the six faces of a skin box. paint(face, x, y, fw, fh) -> colour or None."""
    faces = {
        "top": (u + d, v, w, d), "bottom": (u + d + w, v, w, d),
        "right": (u, v + d, d, h), "front": (u + d, v + d, w, h),
        "left": (u + d + w, v + d, d, h), "back": (u + d + w + d, v + d, w, h),
    }
    for name, (fx, fy, fw, fh) in faces.items():
        for y in range(fh):
            for x in range(fw):
                img.set(fx + x, fy + y, paint(name, x, y, fw, fh))


def make(style, slim):
    p = STYLES[style]
    im = Img(64, 64)
    arm_w = 3 if slim else 4

    def head(face, x, y, fw, fh):
        s = p["skin"]
        if face == "top":
            return p["hair"] if (x + y) % 5 else p["hair2"]
        if face == "bottom":
            return p["skin2"]
        if face == "back":
            return p["hair"] if y < 7 or p["long"] else p["hair2"]
        if face in ("left", "right"):
            return p["hair"] if (y < 3 or (p["long"] and x > 2)) else s
        # front
        if y < 2 or (y < 3 and x in (0, 7)) or (p["fringe"] and y < 3 and x in (1, 6)):
            return p["hair"] if (x + y) % 4 else p["hair2"]
        if y == 3 and x in (1, 2, 5, 6):
            return p["hair2"]
        if y == 4 and x in (1, 6):
            return rgb("#f4f8ff")
        if y == 4 and x in (2, 5):
            return p["eye"]
        if y == 6 and x in (3, 4):
            return p["mouth"]
        if y == 5 and x in (3, 4):
            return p["skin2"]
        return s

    def torso(face, x, y, fw, fh):
        if face == "top":
            return p["top"]
        if face == "bottom":
            return p["top2"]
        c = dith(p["top"], p["top2"], y / (fh * 1.1), x, y)
        if face == "front":
            cx = 3
            if p["emblem"] and y in (2, 3, 4, 5) and x in (3, 4):
                crescent = {(3, 2), (4, 2), (3, 3), (3, 4), (3, 5), (4, 5)}
                if (x, y) in crescent:
                    return p["emblem"]
            if p["stripe"] and x in (0, 7):
                return p["stripe"]
            if p["belt"] and y == fh - 2:
                return p["belt"]
        if face == "back" and p["stripe"] and x in (0, 7):
            return p["stripe"]
        return c

    def arm(face, x, y, fw, fh):
        if face in ("top", "bottom"):
            return p["top"]
        if y >= fh - 3:
            return p["skin"] if not p["gloves"] else p["gloves"]
        c = dith(p["top"], p["top2"], y / (fh * 1.2), x + 1, y)
        if p["cuff"] and y == fh - 4:
            return p["cuff"]
        return c

    def leg(face, x, y, fw, fh):
        if face in ("top", "bottom"):
            return p["pants"]
        if y >= fh - 3:
            return p["sole"] if y == fh - 1 else p["shoe"]
        c = dith(p["pants"], p["pants2"], y / (fh * 1.3), x, y)
        if p["stripe2"] and x == 0 and face in ("front", "back"):
            return p["stripe2"]
        return c

    box(im, 0, 0, 8, 8, 8, head)
    box(im, 16, 16, 8, 12, 4, torso)
    box(im, 40, 16, arm_w, 12, 4, arm)       # right arm
    box(im, 32, 48, arm_w, 12, 4, arm)       # left arm
    box(im, 0, 16, 4, 12, 4, leg)            # right leg
    box(im, 16, 48, 4, 12, 4, leg)           # left leg

    # Overlay layer: hood / collar / cloak details
    def hood(face, x, y, fw, fh):
        if not p["hood"]:
            return None
        if face == "top":
            return p["hood"]
        if face in ("left", "right") and (x > 3 or y < 2):
            return dith(p["hood"], p["hood2"], y / 8, x, y)
        if face == "back":
            return dith(p["hood"], p["hood2"], y / 8, x, y)
        if face == "front" and y == 0:
            return p["hood"]
        return None

    box(im, 32, 0, 8, 8, 8, hood)

    def jacket(face, x, y, fw, fh):
        if not p["jacket"]:
            return None
        if face == "front" and y < 2:
            return p["jacket"]  # collar
        if face in ("left", "right", "back") and y < 2:
            return p["jacket"]
        if face == "front" and x in (3, 4) and p["zip"]:
            return p["zip"]
        return None

    box(im, 16, 32, 8, 12, 4, jacket)
    return im


STYLES = {
    # Luminos Pilot: navy hoodie with a pixel crescent, the default skin
    "pilot": dict(skin=rgb("#e8b896"), skin2=rgb("#d09c78"), hair=rgb("#1b2a6b"), hair2=rgb("#2f4fd0"), long=False,
                  fringe=True, eye=rgb("#3b82f6"), mouth=rgb("#b5705a"), top=rgb("#233a9e"), top2=rgb("#141f5c"),
                  emblem=rgb("#e6f0ff"), stripe=None, belt=None, gloves=None, cuff=rgb("#0f1844"),
                  pants=rgb("#1a2350"), pants2=rgb("#0f1636"), stripe2=rgb("#3b82f6"), shoe=rgb("#f1f5ff"),
                  sole=rgb("#3b82f6"), hood=rgb("#1b2d86"), hood2=rgb("#101a56"), jacket=rgb("#2d4bd0"),
                  zip=None),
    # Moonlit: pale robe, silver hair
    "moonlit": dict(skin=rgb("#f0d0b8"), skin2=rgb("#d9b399"), hair=rgb("#cfd8ee"), hair2=rgb("#9fb0d8"), long=True,
                    fringe=False, eye=rgb("#6d5cff"), mouth=rgb("#c07a74"), top=rgb("#dfe8ff"), top2=rgb("#7f98d8"),
                    emblem=rgb("#3b4fb8"), stripe=rgb("#9fb4ee"), belt=rgb("#3b4fb8"), gloves=None, cuff=rgb("#3b4fb8"),
                    pants=rgb("#a9bae8"), pants2=rgb("#6479c0"), stripe2=None, shoe=rgb("#2a3a8a"),
                    sole=rgb("#14205e"), hood=None, hood2=None, jacket=rgb("#f4f8ff"), zip=None),
    # Ember: charcoal jacket, amber trim
    "ember": dict(skin=rgb("#b9805c"), skin2=rgb("#a06b4a"), hair=rgb("#2a1a14"), hair2=rgb("#e0701c"), long=False,
                  fringe=False, eye=rgb("#ffb03a"), mouth=rgb("#7a4333"), top=rgb("#30343f"), top2=rgb("#171a22"),
                  emblem=rgb("#ffb03a"), stripe=rgb("#e0701c"), belt=None, gloves=rgb("#e0701c"), cuff=rgb("#e0701c"),
                  pants=rgb("#22252e"), pants2=rgb("#12141a"), stripe2=rgb("#e0701c"), shoe=rgb("#3a3f4d"),
                  sole=rgb("#e0701c"), hood=None, hood2=None, jacket=rgb("#454b5a"), zip=rgb("#ffb03a")),
    # Dither Knight: steel armour, blue plume
    "knight": dict(skin=rgb("#e2b392"), skin2=rgb("#c8977a"), hair=rgb("#8c9ab8"), hair2=rgb("#5d6c92"), long=False,
                   fringe=True, eye=rgb("#1d4ed8"), mouth=rgb("#a8645a"), top=rgb("#9eacc8"), top2=rgb("#4e5c82"),
                   emblem=rgb("#2563eb"), stripe=rgb("#2563eb"), belt=rgb("#2563eb"), gloves=rgb("#6b7a9c"),
                   cuff=rgb("#2563eb"), pants=rgb("#6c7a9e"), pants2=rgb("#3d4868"), stripe2=None,
                   shoe=rgb("#4e5c82"), sole=rgb("#242c46"), hood=rgb("#8795b4"), hood2=rgb("#4e5c82"),
                   jacket=rgb("#b6c2dc"), zip=None),
}

SKINS = [("luminos-pilot", "pilot", False), ("luminos-moonlit", "moonlit", True),
         ("luminos-ember", "ember", False), ("luminos-knight", "knight", False)]


def cape():
    im = Img(64, 32)
    deep, mid, hi, white = rgb("#101a56"), rgb("#233a9e"), rgb("#3b82f6"), rgb("#eaf2ff")
    # outside (the face people see from behind): x 1..10, y 1..16
    for y in range(16):
        for x in range(10):
            im.set(1 + x, 1 + y, dith(mid, deep, y / 15.0, x, y))
    # pixel moon (circle, lit from upper-left) centred at (5.5, 6)
    for y in range(16):
        for x in range(10):
            dx, dy = x - 4.5, y - 5.5
            r2 = dx * dx + dy * dy
            if r2 <= 9.5:
                lit = (dx * -0.7 + dy * -0.7) / 3.2
                im.set(1 + x, 1 + y, white if lit > 0.15 else dith(hi, white, 0.5 + lit, x, y))
    # hem stripe
    im.rect(1, 15, 10, 2, hi)
    # inside, sides, top, bottom
    for y in range(16):
        for x in range(10):
            im.set(12 + x, 1 + y, dith(deep, mid, y / 15.0, x, y))
    for y in range(16):
        im.set(0, 1 + y, deep)
        im.set(11, 1 + y, deep)
    im.rect(1, 0, 10, 1, mid)
    im.rect(11, 0, 10, 1, deep)
    return im


if __name__ == "__main__":
    for name, style, slim in SKINS:
        im = make(style, slim)
        write_png(os.path.join(OUT, name + ".png"), 64, 64, im.px)
    c = cape()
    write_png(os.path.join(OUT, "luminos-moon-cape.png"), 64, 32, c.px)
    print("wrote", len(SKINS), "skins and 1 cape to", os.path.normpath(OUT))
