# Generates public/og-card.png — the 1200x630 social share card (og:image / twitter:image).
# One-time asset; rerun after a branding change:  python scripts/og-card.py
# Downloads brand fonts (Google Fonts repo) and the WPR logo at build time; nothing ships at runtime.
import io
import math
import urllib.request
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public" / "og-card.png"

NAVY = (18, 40, 75)
GOLD = (200, 162, 58)
RED = (155, 34, 38)
PAPER = (247, 245, 240)
MUTED_BLUE = (205, 214, 227)

FRAUNCES = "https://github.com/google/fonts/raw/main/ofl/fraunces/Fraunces%5BSOFT%2CWONK%2Copsz%2Cwght%5D.ttf"
PUBLIC_SANS = "https://github.com/google/fonts/raw/main/ofl/publicsans/PublicSans%5Bwght%5D.ttf"
WPR_LOGO = "https://wausaupilotandreview.com/wp-content/uploads/2024/04/WausauPilotandReviewLogo.png"


def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req) as r:
        return r.read()


def font(data, size, weight=None):
    f = ImageFont.truetype(io.BytesIO(data), size)
    if weight is not None:
        try:
            axes = [weight if a.axis == "wght" else a.default for a in f.get_variation_axes()]
            f.set_variation_by_axes(axes)
        except Exception:
            pass
    return f


def baseball(img, cx, cy, r):
    size = img.size
    ball = Image.new("RGBA", size, (0, 0, 0, 0))
    bd = ImageDraw.Draw(ball)
    bd.ellipse([cx - r, cy - r, cx + r, cy + r], fill=PAPER + (255,), outline=(220, 214, 200, 255), width=3)

    # Seams on their own layer, then clipped to the ball's interior so nothing spills out.
    seams = Image.new("RGBA", size, (0, 0, 0, 0))
    sd = ImageDraw.Draw(seams)
    for side in (-1, 1):
        seam_cx = cx + side * r * 1.62
        sr = r * 1.18
        bbox = [seam_cx - sr, cy - sr, seam_cx + sr, cy + sr]
        sd.arc(bbox, 0, 360, fill=RED + (255,), width=7)
        for deg in range(0, 360, 9):
            a = math.radians(deg)
            px = seam_cx + sr * math.cos(a)
            py = cy + sr * math.sin(a)
            ta = a + math.pi / 2
            for flip in (1, -1):
                sa = ta + flip * math.radians(38)
                sd.line([px, py, px + 15 * math.cos(sa) * flip, py + 15 * math.sin(sa) * flip],
                        fill=RED + (255,), width=5)
    clip = Image.new("L", size, 0)
    ImageDraw.Draw(clip).ellipse([cx - r + 6, cy - r + 6, cx + r - 6, cy + r - 6], fill=255)
    seams.putalpha(ImageChops.multiply(seams.split()[3], clip))
    ball.alpha_composite(seams)
    img.paste(ball, (0, 0), ball)


def main():
    fraunces = fetch(FRAUNCES)
    public_sans = fetch(PUBLIC_SANS)
    logo = Image.open(io.BytesIO(fetch(WPR_LOGO))).convert("RGBA")

    img = Image.new("RGB", (1200, 630), NAVY)
    d = ImageDraw.Draw(img)
    d.rectangle([0, 0, 1200, 10], fill=GOLD)

    baseball(img, 990, 330, 175)
    d = ImageDraw.Draw(img)

    kicker = font(public_sans, 26, weight=700)
    d.text((80, 96), "W A U S A U   P I L O T   &   R E V I E W", font=kicker, fill=GOLD)

    head = font(fraunces, 78, weight=600)
    d.text((76, 162), "The Brewers,", font=head, fill="white")
    d.text((76, 254), "by the numbers", font=head, fill="white")

    sub = font(public_sans, 29, weight=400)
    d.text((80, 396), "Live standings · the division race · schedule ·", font=sub, fill=MUTED_BLUE)
    d.text((80, 438), "team leaders — updated all season long", font=sub, fill=MUTED_BLUE)

    # WPR logo on a white chip, bottom-left.
    logo_w = 300
    logo_h = round(logo.height * logo_w / logo.width)
    logo = logo.resize((logo_w, logo_h), Image.LANCZOS)
    pad = 16
    chip = Image.new("RGBA", (logo_w + pad * 2, logo_h + pad * 2), (255, 255, 255, 255))
    mask = Image.new("L", chip.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, chip.width, chip.height], radius=12, fill=255)
    img.paste(chip, (78, 630 - chip.height - 52), mask)
    img.paste(logo, (78 + pad, 630 - chip.height - 52 + pad), logo)

    OUT.parent.mkdir(exist_ok=True)
    img.save(OUT, "PNG")
    print(f"wrote {OUT} ({OUT.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
