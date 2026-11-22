#!/usr/bin/env python3
"""Generates the Luminos brand assets (logo SVG, PNGs, Windows .ico, installer bitmaps).

The mark is a pixel-built "L" whose inner corner emits a spark of light that fades out
with an ordered-dither trail. It sits on a rounded deep-blue tile.

    pip install pillow && python tools/make_brand.py
"""
import os
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GRID = 8
# (x, y, alpha) on an 8x8 grid -- keep in sync with launcher/crates/luminos-app/src/widgets.rs
L_PIXELS = [(x, y, 1) for x in (2, 3) for y in range(1, 7)] + [
    (x, y, 1) for x in (4, 5) for y in (5, 6)
] + [(6, 6, 0.85), (7, 5, 0.55), (6, 5, 0.3), (7, 6, 0.3)]  # foot dissolves into dither
SPARK = [(6, 1, 1)]
TRAIL = [(7, 0, 0.6), (5, 2, 0.5), (7, 2, 0.35), (5, 0, 0.3), (6, 3, 0.2)]

TOP = (92, 160, 255)
BOT = (24, 52, 214)
LIGHT = (214, 236, 255)


def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def render(size: int) -> Image.Image:
    ss = 4
    S = size * ss
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    grad = Image.new("RGBA", (S, S))
    gd = ImageDraw.Draw(grad)
    for y in range(S):
        gd.line([(0, y), (S, y)], fill=lerp(TOP, BOT, y / S) + (255,))
    mask = Image.new("L", (S, S), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, S - 1, S - 1], radius=int(S * 0.23), fill=255)
    img.paste(grad, (0, 0), mask)
    d = ImageDraw.Draw(img, "RGBA")
    pad = S * 0.12
    u = (S - 2 * pad) / GRID

    def cell(x, y, col, a):
        d.rectangle(
            [pad + x * u, pad + y * u, pad + (x + 1) * u - 1, pad + (y + 1) * u - 1],
            fill=col + (int(255 * a),),
        )

    for x, y, a in TRAIL:
        cell(x, y, LIGHT, a)
    for x, y, a in L_PIXELS:
        cell(x, y, (255, 255, 255), a)
    for x, y, a in SPARK:
        cell(x, y, LIGHT, a)
    d.rounded_rectangle([S * 0.02, S * 0.02, S * 0.98, S * 0.98], radius=int(S * 0.21),
                        outline=(255, 255, 255, 46), width=max(1, S // 128))
    return img.resize((size, size), Image.LANCZOS)


def svg() -> str:
    size = 256
    pad = 30
    uu = (size - 2 * pad) / GRID
    out = [
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {size} {size}" width="{size}" height="{size}">',
        '<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">'
        f'<stop offset="0" stop-color="rgb{TOP}"/><stop offset="1" stop-color="rgb{BOT}"/></linearGradient></defs>',
        f'<rect width="{size}" height="{size}" rx="{size*0.23:.0f}" fill="url(#g)"/>',
        f'<rect x="3" y="3" width="{size-6}" height="{size-6}" rx="{size*0.21:.0f}" fill="none" stroke="#fff" stroke-opacity=".18" stroke-width="2"/>',
    ]

    def cell(x, y, col, a):
        out.append(
            f'<rect x="{pad+x*uu:.2f}" y="{pad+y*uu:.2f}" width="{uu:.2f}" height="{uu:.2f}" fill="{col}" fill-opacity="{a}"/>'
        )

    for x, y, a in TRAIL:
        cell(x, y, "#d6ecff", a)
    for x, y, a in L_PIXELS:
        cell(x, y, "#ffffff", a)
    for x, y, a in SPARK:
        cell(x, y, "#d6ecff", a)
    out.append("</svg>")
    return "\n".join(out)


def installer_bitmaps(dst):
    """Inno Setup wizard images: 164x314 sidebar and 55x55 small."""
    W, H = 164, 314
    side = Image.new("RGB", (W, H))
    px = side.load()
    bayer = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]
    for y in range(H):
        for x in range(W):
            base = lerp((9, 20, 70), (3, 6, 22), y / H)
            g = max(0.0, 1.0 - (((x - 20) ** 2 + (y - 30) ** 2) ** 0.5) / 190)
            thr = (bayer[y % 4][x % 4] + 0.5) / 16
            px[x, y] = lerp(base, (60, 120, 255), 0.55) if g * 0.9 > thr * 0.9 and g > 0.05 else base
    logo = render(84)
    side.paste(logo, ((W - 84) // 2, 110), logo)
    side.save(os.path.join(dst, "wizard-side.bmp"))
    small = Image.new("RGB", (55, 55), (6, 12, 40))
    lg = render(47)
    small.paste(lg, (4, 4), lg)
    small.save(os.path.join(dst, "wizard-small.bmp"))


if __name__ == "__main__":
    brand = os.path.join(ROOT, "brand")
    os.makedirs(brand, exist_ok=True)
    big = render(512)
    big.save(os.path.join(brand, "luminos-512.png"))
    big.resize((256, 256), Image.LANCZOS).save(os.path.join(brand, "luminos-256.png"))
    big.resize((64, 64), Image.LANCZOS).save(os.path.join(brand, "luminos-64.png"))
    big.save(os.path.join(brand, "luminos.ico"),
             sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
    with open(os.path.join(brand, "luminos.svg"), "w") as f:
        f.write(svg())
    installer_bitmaps(brand)
    print("brand assets written to", brand)
