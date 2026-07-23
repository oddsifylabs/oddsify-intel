"""
Draws the Oddsify Intel app icon at native resolution for each size,
rather than downscaling a single raster. Kept dependency-free (PIL only).
"""
from PIL import Image, ImageDraw
import math
import os

INK_TOP = (18, 22, 31)      # #12161f
INK_BOTTOM = (11, 14, 20)   # #0b0e14
LINE = (35, 42, 56)         # #232a38
AMBER = (255, 176, 32)      # #ffb020
TEAL = (45, 212, 191)       # #2dd4bf

OUT_DIR = "icons"
os.makedirs(OUT_DIR, exist_ok=True)

def rounded_rect(draw, box, radius, fill=None, outline=None, width=1):
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)

def vertical_gradient(size, top, bottom):
    img = Image.new("RGB", (1, size), 0)
    for y in range(size):
        t = y / max(size - 1, 1)
        r = round(top[0] + (bottom[0] - top[0]) * t)
        g = round(top[1] + (bottom[1] - top[1]) * t)
        b = round(top[2] + (bottom[2] - top[2]) * t)
        img.putpixel((0, y), (r, g, b))
    return img.resize((size, size))

def draw_icon(size, corner_ratio=0.1875, with_border=True, ticks=True):
    """corner_ratio ~ 96/512 default; set to 0 for a maskable-safe full-bleed square variant."""
    base = vertical_gradient(size, INK_TOP, INK_BOTTOM).convert("RGBA")
    draw = ImageDraw.Draw(base)

    # rounded-square mask so corners are transparent (nice for favicon/apple-touch)
    radius = int(size * corner_ratio)
    mask = Image.new("L", (size, size), 0)
    mdraw = ImageDraw.Draw(mask)
    mdraw.rounded_rectangle([0, 0, size - 1, size - 1], radius=radius, fill=255)
    base.putalpha(mask)

    if with_border:
        bw = max(1, round(size * 0.008))
        inset = bw * 2
        draw.rounded_rectangle(
            [inset, inset, size - 1 - inset, size - 1 - inset],
            radius=int(radius * 0.92),
            outline=LINE + (255,),
            width=bw,
        )

    cx, cy = size * 0.5, size * 0.40
    if ticks:
        y = size * 0.765
        tick_w = max(2, round(size * 0.007))
        for x0, x1 in [(0.1875, 0.285), (0.332, 0.43), (0.57, 0.668), (0.715, 0.8125)]:
            draw.line([(size * x0, y), (size * x1, y)], fill=LINE + (255,), width=tick_w * 6 if size >= 128 else tick_w)

    # rotated diamond (square rotated 45deg)
    half = size * 0.215
    pts = [
        (cx, cy - half),
        (cx + half, cy),
        (cx, cy + half),
        (cx - half, cy),
    ]
    draw.polygon(pts, fill=AMBER + (255,))

    # live/odds pulse dot
    r_outer = size * 0.051
    r_inner = size * 0.0254
    draw.ellipse([cx - r_outer, cy - r_outer, cx + r_outer, cy + r_outer], fill=INK_BOTTOM + (255,))
    draw.ellipse([cx - r_inner, cy - r_inner, cx + r_inner, cy + r_inner], fill=TEAL + (255,))

    return base

SIZES = [16, 32, 48, 180, 192, 512]
for s in SIZES:
    img = draw_icon(s)
    img.save(f"{OUT_DIR}/icon-{s}.png")

# maskable variant for Android adaptive icons: full-bleed, no rounded corners
# (Android applies its own mask, so content needs to be full-bleed + centered
# with extra padding so nothing gets clipped)
maskable = draw_icon(512, corner_ratio=0, with_border=False, ticks=False)
maskable.save(f"{OUT_DIR}/icon-512-maskable.png")

print("done:", os.listdir(OUT_DIR))
