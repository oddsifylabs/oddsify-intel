"""
Builds the social-preview (og:image) banner: 1200x630, same ink/amber
terminal aesthetic as the app itself, with a mocked ticker row for
texture. PIL only, no network/font-download needed.
"""
from PIL import Image, ImageDraw, ImageFont

W, H = 1200, 630
INK_TOP = (18, 22, 31)
INK_BOTTOM = (11, 14, 20)
LINE = (35, 42, 56)
PAPER = (232, 234, 237)
DIM = (139, 147, 167)
DIMMER = (91, 99, 118)
AMBER = (255, 176, 32)
TEAL = (45, 212, 191)

MONO_BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf"
MONO = "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf"
SANS_BOLD = "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf"

def vgrad(w, h, top, bottom):
    img = Image.new("RGB", (1, h), 0)
    for y in range(h):
        t = y / max(h - 1, 1)
        img.putpixel((0, y), tuple(round(top[i] + (bottom[i] - top[i]) * t) for i in range(3)))
    return img.resize((w, h))

img = vgrad(W, H, INK_TOP, INK_BOTTOM).convert("RGB")
draw = ImageDraw.Draw(img)

# subtle border
draw.rectangle([0, 0, W - 1, H - 1], outline=LINE, width=2)

# --- wordmark row ---
diamond_cx, diamond_cy, half = 90, 100, 20
draw.polygon(
    [(diamond_cx, diamond_cy - half), (diamond_cx + half, diamond_cy),
     (diamond_cx, diamond_cy + half), (diamond_cx - half, diamond_cy)],
    fill=AMBER,
)
draw.ellipse([diamond_cx - 9, diamond_cy - 9, diamond_cx + 9, diamond_cy + 9], fill=INK_BOTTOM)
draw.ellipse([diamond_cx - 4, diamond_cy - 4, diamond_cx + 4, diamond_cy + 4], fill=TEAL)

f_word = ImageFont.truetype(SANS_BOLD, 44)
draw.text((130, 76), "ODDSIFY", font=f_word, fill=PAPER)
w_oddsify = draw.textlength("ODDSIFY", font=f_word)
draw.text((130 + w_oddsify + 12, 76), "INTEL", font=f_word, fill=AMBER)

# --- tagline ---
f_tag = ImageFont.truetype(MONO, 24)
draw.text((92, 160), "live scores · standings · odds · matchup intel", font=f_tag, fill=DIM)

# --- league row ---
f_league = ImageFont.truetype(MONO_BOLD, 22)
leagues = ["MLB", "NBA", "NCAAB", "EPL", "UCL", "MLS", "USLC"]
x = 92
y_league = 214
for lg in leagues:
    tw = draw.textlength(lg, font=f_league)
    draw.rounded_rectangle([x, y_league, x + tw + 28, y_league + 40], radius=6, outline=LINE, width=2)
    draw.text((x + 14, y_league + 8), lg, font=f_league, fill=DIM)
    x += tw + 28 + 14

# --- mock game cards (3 columns) ---
card_y = 300
card_h = 250
card_w = 330
gap = 24
cards = [
    ("NYY", "12", "TB", "9", "Line: TB -1.5", True),
    ("MIA", "—", "CHI", "—", "7:30 PM ET", False),
    ("GSW", "104", "LAL", "98", "Line: GSW -3.5", False),
]
f_team = ImageFont.truetype(MONO_BOLD, 26)
f_score = ImageFont.truetype(MONO_BOLD, 26)
f_meta = ImageFont.truetype(MONO, 18)

for i, (away, ascore, home, hscore, meta, live) in enumerate(cards):
    cx0 = 92 + i * (card_w + gap)
    draw.rounded_rectangle([cx0, card_y, cx0 + card_w, card_y + card_h], radius=8, fill=(18, 22, 31), outline=LINE, width=2)
    pad = 24
    draw.text((cx0 + pad, card_y + pad), away, font=f_team, fill=PAPER if not live else TEAL)
    sc_w = draw.textlength(ascore, font=f_score)
    draw.text((cx0 + card_w - pad - sc_w, card_y + pad), ascore, font=f_score, fill=PAPER)

    draw.text((cx0 + pad, card_y + pad + 46), home, font=f_team, fill=DIM)
    sc_w2 = draw.textlength(hscore, font=f_score)
    draw.text((cx0 + card_w - pad - sc_w2, card_y + pad + 46), hscore, font=f_score, fill=DIM)

    draw.line([(cx0 + pad, card_y + 130), (cx0 + card_w - pad, card_y + 130)], fill=LINE, width=1)
    is_odds_line = meta.startswith("Line:")
    meta_color = TEAL if live else (AMBER if is_odds_line else DIM)
    draw.text((cx0 + pad, card_y + 150), ("● LIVE  " if live else "") + meta, font=f_meta, fill=meta_color)

    # tiny star to echo the watchlist feature
    draw.text((cx0 + card_w - pad - 22, card_y + pad - 2), "★" if i == 0 else "☆", font=ImageFont.truetype(MONO_BOLD, 26), fill=AMBER if i == 0 else DIMMER)

# --- footer strip ---
f_foot = ImageFont.truetype(MONO, 20)
draw.rectangle([0, 592, W, 594], fill=LINE)
draw.text((92, 604), "self-hosted · no API key · open source", font=f_foot, fill=DIMMER)

img.save("social-preview.png")
print("saved social-preview.png", img.size)
