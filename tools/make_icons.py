#!/usr/bin/env python3
"""Luminos original voxel icon set (B2). Pure stdlib, deterministic.

Every icon is drawn here from polygons / lines / discs on a 16x16 grid with a shared palette and an
auto-generated 1px outline. Nothing is traced from or extracted out of Minecraft's textures.

    python3 tools/make_icons.py          # writes brand/icons/{svg,png}/, manifest.json, sheet.png
    python3 tools/test_icons.py          # checks size, palette, determinism, uniqueness
"""
import json, os, struct, zlib

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "brand", "icons")
N = 16
PAL = {
    "k": "#0a1030", "w": "#f2f6ff", "B": "#8fb4ff", "b": "#3b6cf0", "d": "#1d3a9e",
    "g": "#48d6a0", "G": "#1f8f66", "y": "#ffc442", "o": "#f08a3c", "r": "#ff6870",
    "R": "#b8323c", "e": "#a06a3c", "E": "#5e3b1e", "s": "#a9b4d0", "S": "#6c7898",
    "c": "#6ee7f5", "C": "#2aa7c0", "t": "#d08a52", "T": "#8a4f27", "n": "#12204d",
}


class Cv:
    def __init__(self):
        self.p = {}

    def set(self, x, y, c):
        if 0 <= x < N and 0 <= y < N:
            self.p[(x, y)] = c

    def rect(self, x0, y0, x1, y1, c):
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                self.set(x, y, c)

    def line(self, x0, y0, x1, y1, c, w=1):
        dx, dy = abs(x1 - x0), -abs(y1 - y0)
        sx, sy = (1 if x0 < x1 else -1), (1 if y0 < y1 else -1)
        err = dx + dy
        while True:
            for ox in range(w):
                for oy in range(w):
                    self.set(x0 + ox, y0 + oy, c)
            if x0 == x1 and y0 == y1:
                break
            e2 = 2 * err
            if e2 >= dy:
                err += dy; x0 += sx
            if e2 <= dx:
                err += dx; y0 += sy

    def disc(self, cx, cy, r, c):
        for y in range(N):
            for x in range(N):
                if (x + .5 - cx) ** 2 + (y + .5 - cy) ** 2 <= r * r:
                    self.set(x, y, c)

    def poly(self, pts, c):
        for y in range(N):
            for x in range(N):
                px, py, inside = x + .5, y + .5, False
                j = len(pts) - 1
                for i in range(len(pts)):
                    xi, yi = pts[i]; xj, yj = pts[j]
                    if (yi > py) != (yj > py) and px < (xj - xi) * (py - yi) / (yj - yi) + xi:
                        inside = not inside
                    j = i
                if inside:
                    self.set(x, y, c)

    def outline(self):
        filled = set(self.p)
        for (x, y) in list(filled):
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                q = (x + dx, y + dy)
                if q not in filled and 0 <= q[0] < N and 0 <= q[1] < N:
                    self.p[q] = "k"
        return self


def noise(cv, region, c, seed, n):
    """Deterministic speckle: LCG over the cells of `region` that are already painted."""
    cells = sorted(k for k in cv.p if region(*k))
    s = seed
    for _ in range(n):
        s = (s * 1103515245 + 12345) & 0x7FFFFFFF
        if cells:
            cv.p[cells[s % len(cells)]] = c


def cube(top, left, right, seed=1, speck=None):
    cv = Cv()
    cv.poly([(8, 1), (15, 4.5), (8, 8), (1, 4.5)], top)
    cv.poly([(1, 4.5), (8, 8), (8, 15), (1, 11.5)], left)
    cv.poly([(8, 8), (15, 4.5), (15, 11.5), (8, 15)], right)
    if speck:
        noise(cv, lambda x, y: y < 8 and cv.p[(x, y)] == top, speck, seed, 5)
    for x in range(3, 7):
        cv.p[(x, 3 if x > 4 else 4)] = cv.p.get((x, 3 if x > 4 else 4), top)
    return cv


def heart():
    cv = Cv()
    for y, row in enumerate(["..rr..rr..", ".rrrrrrrr.", "rrrrrrrrrr", "rrrrrrrrrr", ".rrrrrrrr.", "..rrrrrr..", "...rrrr...", "....rr...."]):
        for x, ch in enumerate(row):
            if ch == "r":
                cv.set(3 + x - 2, 3 + y, "r")
    cv.set(2, 4, "w"); cv.set(3, 3, "w"); cv.set(2, 5, "w")
    for x, y in ((6, 10), (7, 11), (8, 11)):
        cv.set(x, y, "R")
    return cv


def icons():
    I = {}
    # ---- versions: one cube per supported version, own material so they read apart at 16px
    I["versions/v1-21-4"] = cube("g", "e", "E", 3, "G")
    I["versions/v1-21-11"] = cube("t", "T", "e", 5, "o")
    I["versions/v26-1-2"] = cube("c", "B", "b", 7, "w")
    I["versions/v26-2"] = cube("y", "o", "T", 11, "w")
    I["versions/v26-3"] = cube("B", "b", "d", 13, "w")
    # ---- loaders (concept symbols, deliberately not the loaders' own logos)
    v = cube("s", "S", "S", 17, "w"); I["loaders/vanilla"] = v
    f = Cv()
    for y in range(2, 14):
        for x in range(2, 14):
            f.set(x, y, "B" if (x + y) % 2 == 0 else "b")
    for x in range(2, 14, 2):
        f.set(x, 1, "w"); f.set(x, 14, "w")
    I["loaders/fabric"] = f
    q = Cv()
    cols = [["g", "y"], ["r", "B"]]
    for py in range(2):
        for px in range(2):
            q.rect(2 + px * 6, 2 + py * 6, 7 + px * 6, 7 + py * 6, cols[py][px])
    for i in range(2, 14):
        if i % 2 == 0:
            q.set(8, i, "w"); q.set(7, i, "w") if False else None
            q.set(i, 8, "w")
    I["loaders/quilt"] = q
    a = Cv()
    a.rect(3, 3, 13, 6, "s"); a.rect(0, 3, 2, 4, "s"); a.rect(5, 7, 10, 9, "S"); a.rect(3, 10, 12, 13, "S")
    a.rect(4, 3, 12, 3, "w"); a.rect(5, 4, 8, 4, "o")
    I["loaders/forge"] = a
    a2 = Cv()
    a2.rect(3, 6, 13, 9, "s"); a2.rect(0, 6, 2, 7, "s"); a2.rect(5, 10, 10, 11, "S"); a2.rect(3, 12, 12, 14, "S")
    a2.rect(4, 6, 12, 6, "w")
    a2.line(8, 0, 8, 4, "c"); a2.line(6, 2, 10, 2, "c"); a2.set(8, 2, "w")
    I["loaders/neoforge"] = a2
    # ---- game modes
    I["modes/survival"] = heart()
    cr = cube("w", "s", "S", 19, "B")
    cr.line(13, 0, 13, 3, "y"); cr.line(12, 1, 14, 1, "y")
    I["modes/creative"] = cr
    ad = Cv(); ad.disc(8, 8, 6.5, "s"); ad.disc(8, 8, 4.8, "n")
    ad.poly([(8, 3), (9.6, 8), (8, 9.2), (6.4, 8)], "r"); ad.poly([(8, 13), (9.6, 8), (8, 6.8), (6.4, 8)], "w")
    ad.set(8, 8, "y")
    I["modes/adventure"] = ad
    sp = Cv(); sp.poly([(1, 8), (4, 4.5), (8, 3), (12, 4.5), (15, 8), (12, 11.5), (8, 13), (4, 11.5)], "w")
    sp.disc(8, 8, 3.6, "b"); sp.disc(8, 8, 1.8, "k"); sp.set(7, 7, "w")
    I["modes/spectator"] = sp
    # ---- items
    sw = Cv(); sw.line(13, 1, 6, 8, "B", 2); sw.line(13, 1, 13, 1, "w"); sw.line(12, 2, 7, 7, "w")
    sw.line(4, 7, 9, 12, "y", 2); sw.line(3, 11, 1, 14, "e", 2); sw.set(1, 14, "E")
    I["items/sword"] = sw
    pk = Cv(); pk.line(7, 8, 13, 14, "e", 2)
    pk.poly([(1, 7), (4, 2), (9, 1), (14, 4), (14, 7), (11, 5), (7, 5), (3, 8)], "s")
    pk.line(4, 3, 10, 2, "w")
    I["items/pickaxe"] = pk
    ap = Cv(); ap.disc(8, 9.5, 5.5, "r"); ap.set(5, 7, "w"); ap.set(5, 8, "w"); ap.set(6, 6, "w")
    ap.rect(8, 2, 8, 4, "E"); ap.poly([(9, 3), (13, 1.5), (12, 5)], "g")
    for y in range(11, 14):
        ap.set(11, y, "R")
    I["items/apple"] = ap
    po = Cv(); po.rect(6, 1, 9, 2, "e"); po.rect(6, 3, 9, 5, "s"); po.disc(8, 10, 5, "c")
    po.rect(5, 6, 10, 8, "c"); po.rect(5, 11, 11, 13, "C"); po.set(5, 9, "w"); po.set(6, 8, "w")
    I["items/potion"] = po
    to = Cv(); to.rect(7, 7, 8, 14, "e"); to.rect(7, 7, 7, 14, "t")
    to.poly([(7.5, 0.5), (10.5, 4), (9.5, 7), (5.5, 7), (4.5, 4)], "o"); to.rect(7, 3, 8, 6, "y"); to.set(7, 4, "w")
    I["items/torch"] = to
    ch = Cv(); ch.rect(2, 5, 13, 13, "e"); ch.rect(2, 3, 13, 6, "t"); ch.rect(2, 7, 13, 7, "E")
    ch.rect(7, 6, 8, 9, "y"); ch.rect(2, 10, 13, 10, "T"); ch.rect(3, 4, 12, 4, "w") if False else None
    I["items/chest"] = ch
    di = Cv(); di.poly([(8, 1), (14, 6), (8, 15), (2, 6)], "c")
    di.poly([(8, 1), (14, 6), (2, 6)], "w"); di.poly([(2, 6), (8, 6), (8, 15)], "C"); di.set(5, 4, "w")
    I["items/diamond"] = di
    # ---- mod categories
    bo = Cv(); bo.poly([(10, 0.5), (3, 9), (7.5, 9), (5.5, 15.5), (13, 6.5), (8.5, 6.5)], "y"); bo.set(9, 2, "w"); bo.set(8, 3, "w")
    I["categories/performance"] = bo
    su = Cv(); su.disc(8, 8, 4, "y"); su.set(7, 6, "w")
    for dx, dy in ((0, -1), (0, 1), (1, 0), (-1, 0)):
        su.line(8 + dx * 6, 8 + dy * 6, 8 + dx * 7, 8 + dy * 7, "o")
    for dx, dy in ((1, 1), (1, -1), (-1, 1), (-1, -1)):
        su.set(8 + dx * 5 - (1 if dx < 0 else 0), 8 + dy * 5 - (1 if dy < 0 else 0), "o")
    I["categories/visuals"] = su
    wr = Cv(); wr.disc(4.5, 4.5, 3.6, "s"); wr.poly([(2, 0), (4.5, 4.5), (7, 0)], "k") if False else None
    wr.line(6, 6, 13, 13, "S", 3); wr.line(7, 6, 13, 12, "s", 1); wr.disc(4.5, 4.5, 1.5, "n"); wr.rect(3, 0, 5, 2, "n")
    I["categories/utility"] = wr
    mt = Cv(); mt.poly([(0, 14), (6, 4), (12, 14)], "s"); mt.poly([(6, 14), (11, 6), (16, 14)], "S")
    mt.poly([(4.2, 7), (6, 4), (7.8, 7), (6, 6)], "w"); mt.rect(0, 13, 15, 14, "G"); mt.disc(12.5, 3, 1.8, "y")
    I["categories/worldgen"] = mt
    dc = Cv(); dc.poly([(3, 9), (13, 9), (11, 15), (5, 15)], "t"); dc.rect(2, 8, 13, 9, "T")
    dc.line(8, 8, 8, 3, "G"); dc.disc(8, 3, 2.2, "r"); dc.set(8, 3, "y"); dc.line(8, 6, 11, 5, "g")
    I["categories/decoration"] = dc
    bk = Cv(); bk.rect(2, 10, 14, 14, "b"); bk.rect(3, 11, 14, 12, "w"); bk.rect(3, 6, 13, 9, "g"); bk.rect(4, 7, 13, 8, "w")
    bk.rect(2, 2, 12, 5, "r"); bk.rect(3, 3, 12, 4, "w")
    I["categories/library"] = bk
    ge = Cv(); ge.disc(8, 8, 6, "S"); ge.disc(8, 8, 4.6, "s")
    for dx, dy in ((0, -1), (0, 1), (1, 0), (-1, 0)):
        ge.rect(7 + dx * 6, 7 + dy * 6, 8 + dx * 6, 8 + dy * 6, "S")
    ge.disc(8, 8, 2, "n"); ge.set(6, 5, "w")
    I["categories/technology"] = ge
    mg = Cv(); mg.line(2, 14, 9, 7, "e", 2)
    mg.poly([(11, 0.5), (12.6, 4.4), (15.5, 5.5), (12.6, 7), (11, 10.5), (9.4, 7), (6.5, 5.5), (9.4, 4.4)], "c"); mg.set(11, 5, "w")
    I["categories/magic"] = mg
    return {k: v.outline() for k, v in I.items()}


# ---------------- writers (deterministic) ----------------
def hex_rgb(h):
    return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))


def svg(cv):
    runs = {}
    for y in range(N):
        x = 0
        while x < N:
            c = cv.p.get((x, y))
            if not c:
                x += 1; continue
            x2 = x
            while cv.p.get((x2 + 1, y)) == c:
                x2 += 1
            runs.setdefault(c, []).append(f"M{x} {y}h{x2 - x + 1}v1h-{x2 - x + 1}z")
            x = x2 + 1
    body = "".join(f'<path fill="{PAL[c]}" d="{"".join(d)}"/>' for c, d in sorted(runs.items()))
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {N} {N}" width="{N * 8}" height="{N * 8}" shape-rendering="crispEdges">{body}</svg>\n'


def png(w, h, rows):
    raw = b"".join(b"\x00" + bytes(r) for r in rows)
    def chunk(t, d):
        c = struct.pack(">I", len(d)) + t + d
        return c + struct.pack(">I", zlib.crc32(t + d) & 0xFFFFFFFF)
    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 6, 0, 0, 0)) + chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b"")


def raster(cv, scale, bg=None):
    rows = []
    for y in range(N):
        line = bytearray()
        for x in range(N):
            c = cv.p.get((x, y))
            px = (*hex_rgb(PAL[c]), 255) if c else ((*bg, 255) if bg else (0, 0, 0, 0))
            line += bytes(px) * scale
        rows += [bytes(line)] * scale
    return rows


def main():
    ic = icons()
    os.makedirs(os.path.join(OUT, "svg"), exist_ok=True)
    os.makedirs(os.path.join(OUT, "png"), exist_ok=True)
    manifest = []
    for key, cv in ic.items():
        group, name = key.split("/")
        slug = f"{group}-{name}"
        open(os.path.join(OUT, "svg", slug + ".svg"), "w").write(svg(cv))
        open(os.path.join(OUT, "png", slug + ".png"), "wb").write(png(N * 8, N * 8, raster(cv, 8)))
        manifest.append({"group": group, "name": name, "svg": f"svg/{slug}.svg", "png": f"png/{slug}.png"})
    json.dump(manifest, open(os.path.join(OUT, "manifest.json"), "w"), indent=2)
    # contact sheet: 8 columns, groups kept in order, night-sky tile behind each icon
    cols, cell, pad, sc = 8, 16 * 6, 14, 6
    rows_n = (len(ic) + cols - 1) // cols
    W, H = cols * (cell + pad) + pad, rows_n * (cell + pad) + pad
    bg = hex_rgb("#050a1f")
    img = [[bg] * W for _ in range(H)]
    for i, cv in enumerate(ic.values()):
        ox, oy = pad + (i % cols) * (cell + pad), pad + (i // cols) * (cell + pad)
        for y in range(cell):
            for x in range(cell):
                c = cv.p.get((x // sc, y // sc))
                img[oy + y][ox + x] = hex_rgb(PAL[c]) if c else hex_rgb("#0a1433")
    rows = [b"".join(bytes((*p, 255)) for p in r) for r in img]
    open(os.path.join(OUT, "sheet.png"), "wb").write(png(W, H, rows))
    print(f"wrote {len(ic)} icons to {os.path.relpath(OUT, ROOT)}")


if __name__ == "__main__":
    main()
