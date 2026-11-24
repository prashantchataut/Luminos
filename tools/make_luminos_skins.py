#!/usr/bin/env python3
"""Draws the five original Luminos skins (64x64, base + outer layer). Original art, CC0-1.0.
Writes app/public/skins/<id>.png, app/src/data/skins.json and docs/research/skins-contact-sheet.png."""
import json, random, pathlib
from PIL import Image
ROOT = pathlib.Path(__file__).resolve().parent.parent
rgb = lambda h: (int(h[1:3], 16), int(h[3:5], 16), int(h[5:7], 16), 255)
def mul(c, k): return tuple(max(0, min(255, round(v * k))) for v in c[:3]) + (c[3] if len(c) > 3 else 255,)
def mix(a, b, t): return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3)) + (255,)
def alpha(c, a): return c[:3] + (a,)
def rnd(x, y, seed): return random.Random((x * 73856093) ^ (y * 19349663) ^ (seed * 83492791)).random()
SHADE = {"front": 1.0, "back": .94, "right": .9, "left": .9, "top": 1.08, "bottom": .72}

def faces(o, d):
    u, v = o; w, h, dd = d
    return {"top": (u + dd, v, w, dd), "bottom": (u + dd + w, v, w, dd), "right": (u, v + dd, dd, h), "front": (u + dd, v + dd, w, h), "left": (u + dd + w, v + dd, dd, h), "back": (u + 2 * dd + w, v + dd, w, h)}

class Skin:
    def __init__(s, slim):
        s.im = Image.new("RGBA", (64, 64), (0, 0, 0, 0)); aw = 3 if slim else 4; s.slim = slim
        s.parts = {"head": ((0, 0), (32, 0), (8, 8, 8)), "body": ((16, 16), (16, 32), (8, 12, 4)), "rarm": ((40, 16), (40, 32), (aw, 12, 4)),
                   "larm": ((32, 48), (48, 48), (aw, 12, 4)), "rleg": ((0, 16), (0, 32), (4, 12, 4)), "lleg": ((16, 48), (0, 48), (4, 12, 4))}
    def paint(s, part, layer, fn, only=None, shade=True):
        for f, (x0, y0, w, h) in faces(s.parts[part][layer], s.parts[part][2]).items():
            if only and f not in only: continue
            for y in range(h):
                for x in range(w):
                    c = fn(f, x, y, w, h, x0 + x, y0 + y)
                    if c:
                        if shade and layer == 0 and c[3] == 255: c = mul(c, SHADE[f])
                        s.im.putpixel((x0 + x, y0 + y), c)
    def both(s, parts, layer, fn, **k):
        for p in parts: s.paint(p, layer, fn, **k)

def head(s, P):
    """Face + hair. P: skin, skin_d, hair, hair_l, eyew, iris, brow, mouth, fringe (row-2 x list), outer_front (row-1 x list)."""
    def base(f, x, y, w, h, ax, ay):
        if f == "top": return P["hair"]
        if f == "bottom": return P["skin_d"]
        if f == "back": return P["hair"] if y <= 6 else P["skin_d"]
        if f in ("right", "left"):
            back = x <= 2 if f == "right" else x >= 5
            if y <= 2 or (back and y <= 6): return P["hair"] if (x + y) % 5 else P["hair_l"]
            return P["skin"]
        if y <= 1: return P["hair"] if (x + y) % 4 else P["hair_l"]
        if y == 2: return P["hair"] if x in P["fringe"] else P["skin"]
        if y == 3 and x in (1, 2, 5, 6): return P["brow"]
        if y == 4:
            if x == 1 or x == 6: return P["eyew"]
            if x == 2 or x == 5: return P["iris"]
        if y == 5 and x in (3, 4): return mix(P["skin"], P["skin_d"], .45)
        if y == 6 and x in (3, 4): return P["mouth"]
        return P["skin"]
    s.paint("head", 0, base)
    def outer(f, x, y, w, h, ax, ay):
        if f == "top": return P["hair_l"]
        if f == "back": return P["hair_l"] if y <= 5 else None
        if f in ("right", "left"):
            back = x <= 1 if f == "right" else x >= 6
            if y <= 1 or (back and y <= 5): return P["hair_l"]
            return None
        if f == "front": return P["hair_l"] if (y == 0 or (y == 1 and x in P["outer_front"])) else None
    s.paint("head", 1, outer, shade=False)

def limbs(s, f_arm, f_leg, f_body, o_arm=None, o_leg=None, o_body=None):
    s.both(["rarm", "larm"], 0, f_arm); s.both(["rleg", "lleg"], 0, f_leg); s.paint("body", 0, f_body)
    if o_arm: s.both(["rarm", "larm"], 1, o_arm, shade=False)
    if o_leg: s.both(["rleg", "lleg"], 1, o_leg, shade=False)
    if o_body: s.paint("body", 1, o_body, shade=False)

# ---------------------------------------------------------------- 1. Luminos Default
def luminos():
    s = Skin(False)
    P = dict(skin=rgb("#e6b793"), skin_d=rgb("#c99973"), hair=rgb("#0e1530"), hair_l=rgb("#1c2a55"), eyew=rgb("#f1efe6"), iris=rgb("#2d5bd0"), brow=rgb("#0a1024"), mouth=rgb("#b9775f"), fringe=[0, 1, 2, 6, 7], outer_front=[0, 1, 7])
    head(s, P)
    N, ND, NL, OFF, GR = rgb("#16254f"), rgb("#0d1836"), rgb("#27407f"), rgb("#f1efe6"), rgb("#c9c6bb")
    MARK = [".####.", "#....#", "#.##.#", "#.##.#", "#....#", ".####."]
    def body(f, x, y, w, h, ax, ay):
        c = N
        if f == "front":
            if y == 0: return OFF
            if x == 3 and 1 <= y <= 10: c = OFF
            elif x == 4 and 1 <= y <= 10: c = ND
            elif y == 4: c = NL
            elif y == 8 and x in (1, 2, 5, 6): c = NL
            elif y == 11: c = OFF
            elif x in (0, 7): c = ND
        elif f == "back":
            if 2 <= y <= 7 and 1 <= x <= 6 and MARK[y - 2][x - 1] == "#": return OFF
            if y == 0 or y == 11: c = OFF if y == 11 else NL
            elif y == 3 and not (1 <= x <= 6): c = NL
            elif x in (0, 7): c = ND
        elif f in ("right", "left") and y == 11: c = OFF
        return c
    def arm(f, x, y, w, h, ax, ay):
        if f == "top": return NL
        if f == "bottom": return OFF
        if y >= 10: return OFF
        if y == 3 or y == 0: return NL
        return N if x else ND if f in ("right", "left") else N
    def leg(f, x, y, w, h, ax, ay):
        if f == "top": return ND
        if f == "bottom": return GR
        if y >= 8: return mul(GR, .78) if y == 11 else GR
        if y == 4 and f == "front": return NL
        stripe = (f == "right" and x in (1, 2)) or (f == "left" and x in (1, 2))
        if stripe: return OFF
        return ND
    def o_body(f, x, y, w, h, ax, ay):
        if y <= 1 and f != "top" and f != "bottom": return OFF if y == 0 else NL
        if y >= 10 and f not in ("top", "bottom"): return OFF if y == 11 else NL
        if f == "front" and y == 6 and x in (3, 4): return None
    def o_arm(f, x, y, w, h, ax, ay):
        if f in ("top",): return NL
        if y == 0: return NL
        if y == 11 and f != "bottom": return OFF
    def o_leg(f, x, y, w, h, ax, ay):
        if f in ("top", "bottom"): return None
        if y <= 1: return NL
        if y >= 10: return OFF
    limbs(s, arm, leg, body, o_arm, o_leg, o_body)
    return s

# ---------------------------------------------------------------- 2. Ember (slim, worn leather)
def ember():
    s = Skin(True)
    P = dict(skin=rgb("#c98f68"), skin_d=rgb("#a8714f"), hair=rgb("#7a3416"), hair_l=rgb("#93441d"), eyew=rgb("#f3e6d0"), iris=rgb("#c9792f"), brow=rgb("#4a1f0c"), mouth=rgb("#8e5037"), fringe=[0, 1, 4, 6, 7], outer_front=[0, 2, 5, 7])
    head(s, P)
    R, RD, RL, C, CL, BR, LE = rgb("#a64b22"), rgb("#7a3416"), rgb("#c4642f"), rgb("#2a2b30"), rgb("#3b3d45"), rgb("#d3ab4f"), rgb("#3b2418")
    def leather(base, seed):
        def g(ax, ay):
            r = rnd(ax, ay, seed); c = mul(base, 1 + (r - .5) * .18)
            if rnd(ax, ay, seed + 9) > .93: c = mul(base, 1.28)          # scuffed highlight
            if rnd(ax // 2, ay, seed + 4) > .955: c = mul(base, .68)     # crease
            return c
        return g
    LJ = leather(R, 1)
    def body(f, x, y, w, h, ax, ay):
        if f == "front":
            if x in (3, 4) and y >= 1: return C if y != 9 else BR
            if x in (2, 5) and y <= 6: return RD
            if y == 9: return C
            if x in (1, 6) and y >= 7: return RD if y % 2 == 0 else LJ(ax, ay)
            return LJ(ax, ay)
        if f == "back":
            if x in (3, 4): return RD
            if y == 3: return RD
            return LJ(ax, ay)
        return LJ(ax, ay) if y != 9 else C
    def arm(f, x, y, w, h, ax, ay):
        if f in ("top", "bottom"): return RL if f == "top" else CL
        if y >= 10: return C if y == 10 else CL
        if y in (5, 6): return mul(RD, 1 + (rnd(ax, ay, 3) - .5) * .2)
        return LJ(ax, ay)
    def leg(f, x, y, w, h, ax, ay):
        if f == "top": return C
        if f == "bottom": return rgb("#241410")
        if y >= 8:
            if f == "front" and y in (8, 10) and x in (1, 2): return RL
            return mul(LE, 1 + (rnd(ax, ay, 6) - .5) * .25) if y < 11 else rgb("#241410")
        c = mul(C, 1 + (rnd(ax, ay, 5) - .5) * .2)
        if y in (5, 6) and f == "front": c = mul(CL, 1.1)
        return c
    def o_body(f, x, y, w, h, ax, ay):
        if f in ("top", "bottom"): return None
        if y <= 1: return mul(C, 1 + (rnd(ax, ay, 8) - .5) * .25)           # scarf
        if y == 9 and f == "front" and x in (3, 4): return BR               # buckle
    def o_arm(f, x, y, w, h, ax, ay):
        if f == "top": return RD
        if y <= 1: return RD
    def o_leg(f, x, y, w, h, ax, ay):
        if f in ("top", "bottom"): return None
        if y in (4, 5): return CL
        if y >= 10: return mul(LE, .85)
    P2 = P
    limbs(s, arm, leg, body, o_arm, o_leg, o_body)
    # headband on the outer head layer, row 2, with a brass stud
    for f in ("front", "right", "left", "back"):
        x0, y0, w, h = faces(s.parts["head"][1], s.parts["head"][2])[f]
        for x in range(w): s.im.putpixel((x0 + x, y0 + 2), C)
    x0, y0, w, h = faces(s.parts["head"][1], s.parts["head"][2])["front"]; s.im.putpixel((x0 + 3, y0 + 2), BR); s.im.putpixel((x0 + 4, y0 + 2), BR)
    return s

# ---------------------------------------------------------------- 3. Glasshouse (botanical back layer)
def glasshouse():
    s = Skin(False)
    P = dict(skin=rgb("#f3cdb4"), skin_d=rgb("#d8aa8f"), hair=rgb("#cfeee0"), hair_l=rgb("#e6f8ef"), eyew=rgb("#ffffff"), iris=rgb("#2f9b73"), brow=rgb("#8fb9a6"), mouth=rgb("#d4837a"), fringe=[0, 1, 2, 5, 6, 7], outer_front=[0, 1, 2, 5, 6, 7])
    head(s, P)
    M, MD, W, LF, LD, FL, FY = rgb("#a9e5cd"), rgb("#7fcdb0"), rgb("#f7fffb"), rgb("#3f9c78"), rgb("#2b7a5c"), rgb("#ffffff"), rgb("#f2d27a")
    def body(f, x, y, w, h, ax, ay):
        if f in ("top", "bottom"): return W
        if y == 11: return M
        if f == "front" and x == 3 and 0 <= y <= 1: return MD
        return W
    def arm(f, x, y, w, h, ax, ay):
        if f == "top": return W
        if f == "bottom": return rgb("#f3cdb4")
        return W if y < 10 else rgb("#f3cdb4")
    def leg(f, x, y, w, h, ax, ay):
        if f == "top": return rgb("#dff2ea")
        if f == "bottom": return M
        if y >= 9: return W if y < 11 else M
        if y == 0: return MD
        return rgb("#dff2ea")
    VINE = [(4, 10), (4, 9), (3, 8), (3, 7), (4, 6), (4, 5), (3, 4), (3, 3), (4, 2)]
    LEAVES = [(5, 10), (6, 9), (2, 8), (1, 7), (5, 6), (6, 5), (2, 4), (1, 3), (5, 2)]
    LEAVES2 = [(6, 10), (7, 9)]
    def o_body(f, x, y, w, h, ax, ay):
        if f in ("top", "bottom"): return None
        if f == "front":
            if x in (3, 4): return None
            return MD if (x in (2, 5) and False) else M
        if f == "back":
            if (x, y) in VINE: return LD
            if (x, y) in LEAVES: return LF
            if (x, y) in LEAVES2: return LF
            if (x, y) in [(3, 1), (4, 1), (3, 0), (4, 0)]: return FL if (x, y) != (3, 1) else FY
            if (x, y) in [(2, 1), (5, 1)]: return alpha(FL, 255)
            if y == 11: return MD
            return M
        return M if y < 11 else MD
    def o_arm(f, x, y, w, h, ax, ay):
        if f in ("top", "bottom"): return M if f == "top" else None
        if y >= 10: return W
        return M
    def o_leg(f, x, y, w, h, ax, ay):
        if f in ("top", "bottom"): return None
        if y >= 10: return W if y == 10 else None
    limbs(s, arm, leg, body, o_arm, o_leg, o_body)
    # long hair falls on the outer head layer back
    x0, y0, w, h = faces(s.parts["head"][1], s.parts["head"][2])["back"]
    for y in range(6, 8):
        for x in range(w): s.im.putpixel((x0 + x, y0 + y), P["hair_l"])
    return s

# ---------------------------------------------------------------- 4. Nightshift (slim, sleeve gradient)
def nightshift():
    s = Skin(True)
    P = dict(skin=rgb("#ead3c8"), skin_d=rgb("#c9aea4"), hair=rgb("#0b0b10"), hair_l=rgb("#17171f"), eyew=rgb("#e8e0ff"), iris=rgb("#a67cff"), brow=rgb("#050508"), mouth=rgb("#a9726f"), fringe=[0, 1, 3, 4, 6, 7], outer_front=[0, 1, 4, 7])
    head(s, P)
    B, BL, V, VL, VD = rgb("#0b0b10"), rgb("#17171f"), rgb("#6a3dd8"), rgb("#a67cff"), rgb("#3c2380")
    # violet streaks in the hair (base layer top + back)
    for (x, y) in [(2, 1), (5, 2), (6, 1)]:
        x0, y0, w, h = faces(s.parts["head"][0], s.parts["head"][2])["front"]; s.im.putpixel((x0 + x, y0 + y), V)
    x0, y0, w, h = faces(s.parts["head"][0], s.parts["head"][2])["back"]
    for (x, y) in [(1, 2), (2, 3), (5, 1), (6, 4)]: s.im.putpixel((x0 + x, y0 + y), V)
    def body(f, x, y, w, h, ax, ay):
        if f in ("top", "bottom"): return B
        if f == "front":
            if x in (2, 5) and 1 <= y <= 3: return VL            # drawstrings
            if 7 <= y <= 10 and 1 <= x <= 6: return BL            # pocket
            if y == 7 and 1 <= x <= 6: return VD
        if f == "back":
            moon = {(3, 3), (4, 3), (2, 4), (2, 5), (2, 6), (3, 7), (4, 7), (4, 4), (3, 5)}
            if (x, y) in {(3, 3), (4, 3), (2, 4), (2, 5), (2, 6), (3, 7), (4, 7), (5, 6)}: return VL
        if y == 11: return VD
        return B
    def grad(y, h): t = y / (h - 1); return mix(B, VD, t ** 1.4 * .85)
    def arm(f, x, y, w, h, ax, ay):
        if f == "top": return BL
        if f == "bottom": return P["skin"]
        if y >= 10: return V if y == 10 else VL
        return grad(y, h)
    def leg(f, x, y, w, h, ax, ay):
        if f == "top": return B
        if f == "bottom": return VL
        if y == 11: return VL
        if y >= 9: return BL
        if f in ("right", "left") and x in (1, 2): return V if (ax + ay) % 1 == 0 and y < 9 else B
        return B
    def o_body(f, x, y, w, h, ax, ay):
        if f in ("top", "bottom"): return None
        if y <= 1: return BL
        if y >= 9: return alpha(VD, 200 + (y - 9) * 18) if y < 11 else VD
    def o_arm(f, x, y, w, h, ax, ay):
        if f in ("top", "bottom"): return None
        return alpha(V, int(10 + 150 * (y / (h - 1)) ** 1.6)) if y > 2 else None
    def o_leg(f, x, y, w, h, ax, ay):
        if f in ("top", "bottom"): return None
        if y <= 1: return BL
        if y >= 10: return BL
    limbs(s, arm, leg, body, o_arm, o_leg, o_body)
    return s

# ---------------------------------------------------------------- 5. Paper (cream and ink, line art)
def paper():
    s = Skin(False)
    CR, CD, K, KL = rgb("#f4ecd8"), rgb("#e3d8bd"), rgb("#1d1d24"), rgb("#55555f")
    P = dict(skin=rgb("#f6efdc"), skin_d=CD, hair=K, hair_l=KL, eyew=CR, iris=K, brow=K, mouth=K, fringe=[0, 1, 2, 3, 5, 6, 7], outer_front=[1, 3, 6])
    head(s, P)
    # hair as hatching: alternate ink and cream columns on the base head
    for f in ("top", "back", "right", "left", "front"):
        x0, y0, w, h = faces(s.parts["head"][0], s.parts["head"][2])[f]
        for y in range(h):
            for x in range(w):
                if s.im.getpixel((x0 + x, y0 + y))[:3] in (K[:3], KL[:3]): s.im.putpixel((x0 + x, y0 + y), K if x % 2 == 0 else mix(CR, K, .25))
    PEAKS = {(2, 7), (3, 6), (4, 5), (5, 6), (6, 7), (1, 8), (0, 9), (7, 8), (2, 6), (4, 6)}
    def body(f, x, y, w, h, ax, ay):
        if f in ("top", "bottom"): return CR
        if y == 0: return K if f == "front" and x in (3, 4) else CR
        if f == "front":
            line = {(1, 9), (2, 8), (3, 7), (4, 6), (5, 7), (6, 8), (6, 9), (5, 10), (4, 11)} if False else set()
            peak = {(0, 10), (1, 9), (2, 8), (3, 7), (4, 8), (5, 9), (6, 10), (7, 11), (5, 7), (6, 6), (7, 7), (4, 4), (5, 4)}
            return K if (x, y) in peak else CR
        if y == 11: return K
        return CR if f != "back" else (K if (x, y) in {(3, 4), (4, 4), (3, 5), (4, 5)} and False else CR)
    def arm(f, x, y, w, h, ax, ay):
        if f in ("top", "bottom"): return CR
        if y in (9, 11): return K
        return CR
    def leg(f, x, y, w, h, ax, ay):
        if f in ("top",): return CR
        if f == "bottom": return K
        if y >= 10: return K
        if y == 8: return KL
        if f == "front" and x == 1 and 1 <= y <= 7: return KL
        return CR
    def o_body(f, x, y, w, h, ax, ay):
        if f in ("top", "bottom"): return None
        if f == "front" and ((x == 2 and y == 1) or (x == 5 and y == 1) or (x == 3 and y == 2) or (x == 4 and y == 2)): return K
        if f == "back" and y in (2, 3) and 2 <= x <= 5: return K if y == 2 else None
    def o_arm(f, x, y, w, h, ax, ay):
        if f in ("top", "bottom"): return None
        if y == 0: return K
    def o_leg(f, x, y, w, h, ax, ay):
        if f in ("top", "bottom"): return None
        if y == 0: return KL
    limbs(s, arm, leg, body, o_arm, o_leg, o_body)
    return s

SKINS = [
    ("luminos-default", "Luminos Default", "classic", luminos, "Dark navy and off-white with clean panel lines and a small Luminos mark on the back."),
    ("ember", "Ember", "slim", ember, "Rust and charcoal. Worn leather jacket, brass buckle, headband."),
    ("glasshouse", "Glasshouse", "classic", glasshouse, "Mint and white with a botanical vine on the back layer."),
    ("nightshift", "Nightshift", "slim", nightshift, "Black and violet hoodie with a gradient down the sleeves."),
    ("paper", "Paper", "classic", paper, "Cream and ink. Minimal line art."),
]
def view(im, back=False):
    """Flat front/back preview for the contact sheet (3D previews are rendered in the app)."""
    out = Image.new("RGBA", (16, 32), (0, 0, 0, 0))
    def blit(src_box, dst, layer_box=None):
        for box in [src_box] + ([layer_box] if layer_box else []):
            out.alpha_composite(im.crop(box), dst)
    return out
if __name__ == "__main__":
    (ROOT / "app/public/skins").mkdir(parents=True, exist_ok=True)
    meta = []
    for id_, name, model, fn, blurb in SKINS:
        sk = fn(); sk.im.save(ROOT / f"app/public/skins/{id_}.png"); meta.append({"id": id_, "name": name, "model": model, "file": f"skins/{id_}.png", "blurb": blurb})
    (ROOT / "app/src/data/skins.json").write_text(json.dumps(meta, indent=2))
    # contact sheet: unfolded textures at 6x on a mid grey so the alpha layer reads
    sheet = Image.new("RGBA", (5 * 64 * 5 + 6 * 12, 64 * 5 + 24), (96, 100, 108, 255))
    for i, (id_, *_rest) in enumerate(SKINS):
        im = Image.open(ROOT / f"app/public/skins/{id_}.png").resize((320, 320), Image.NEAREST); sheet.alpha_composite(im, (12 + i * 332, 12))
    (ROOT / "docs/research").mkdir(parents=True, exist_ok=True); sheet.save(ROOT / "docs/research/skins-contact-sheet.png")
    print("wrote", [m["id"] for m in meta])
