#!/usr/bin/env python3
"""Build Android launcher icons from the single master image icons/icon-499.png.

The web app ships one master icon; Android needs a matrix of densities plus an
adaptive-icon foreground. Generating them here means uploading a new
icons/icon-499.png is enough to change the APK icon -- no hand-exported mipmaps
to forget to update.

Usage:
    python3 scripts/make-launcher-icons.py [--icon PATH] [--res PATH]

Requires Pillow.
"""

import argparse
import sys
from pathlib import Path

try:
    from PIL import Image, ImageDraw
except ImportError:  # pragma: no cover - build-time guard
    sys.exit("error: Pillow is required (pip install pillow)")

# density: legacy launcher size in px (48dp) / adaptive canvas size in px (108dp)
DENSITIES = {
    "mdpi": 48,
    "hdpi": 72,
    "xhdpi": 96,
    "xxhdpi": 144,
    "xxxhdpi": 192,
}
ADAPTIVE_DP = 108
LEGACY_DP = 48
# Android masks the foreground to the inner 66dp of the 108dp canvas.
FOREGROUND_SAFE = 66 / ADAPTIVE_DP


def square(img):
    """Centre-crop to a square so a non-square upload cannot distort."""
    w, h = img.size
    if w == h:
        return img
    side = min(w, h)
    left = (w - side) // 2
    top = (h - side) // 2
    return img.crop((left, top, left + side, top + side))


def render(img, size):
    return img.resize((size, size), Image.LANCZOS)


def round_icon(img, size):
    art = render(img, size)
    mask = Image.new("L", (size * 4, size * 4), 0)
    ImageDraw.Draw(mask).ellipse((0, 0, size * 4 - 1, size * 4 - 1), fill=255)
    mask = mask.resize((size, size), Image.LANCZOS)
    out = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    out.paste(art, (0, 0), mask)
    return out


def foreground(img, canvas):
    art = render(img, max(1, round(canvas * FOREGROUND_SAFE)))
    out = Image.new("RGBA", (canvas, canvas), (0, 0, 0, 0))
    offset = ((canvas - art.width) // 2, (canvas - art.height) // 2)
    out.paste(art, offset, art)
    return out


def main():
    root = Path(__file__).resolve().parent.parent
    ap = argparse.ArgumentParser()
    ap.add_argument("--icon", default=str(root / "icons" / "icon-499.png"))
    ap.add_argument("--res", default=str(root / "resources" / "android" / "res"))
    args = ap.parse_args()

    icon_path = Path(args.icon)
    res_dir = Path(args.res)
    if not icon_path.is_file():
        sys.exit("error: master icon not found: %s" % icon_path)

    with Image.open(icon_path) as opened:
        master = square(opened.convert("RGBA"))

    written = []
    for density, legacy in DENSITIES.items():
        target = res_dir / ("mipmap-" + density)
        target.mkdir(parents=True, exist_ok=True)

        files = {
            "ic_launcher.png": render(master, legacy),
            "ic_launcher_round.png": round_icon(master, legacy),
            "ic_launcher_foreground.png": foreground(
                master, round(legacy * ADAPTIVE_DP / LEGACY_DP)
            ),
        }
        for name, image in files.items():
            path = target / name
            image.save(path, "PNG", optimize=True)
            written.append((path, image.size))

    for path, size in written:
        print("  %s  %dx%d" % (path, size[0], size[1]))
    print("generated %d launcher icons from %s" % (len(written), icon_path))


if __name__ == "__main__":
    main()
