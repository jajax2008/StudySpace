#!/usr/bin/env python3
"""StudySpace app icon themes.

Two icon styles x six themes = twelve master PNGs:

    style1_default.png   style1_theme1.png .. style1_theme5.png
    style2_default.png   style2_theme1.png .. style2_theme5.png

The masters live in ``resources/android/custom-icons/``. Put your own artwork
there (same file names) and this script renders it into every launcher density;
if a master is missing it is recreated from ``icons/icon-499.png`` with the
theme's colours, so the build never depends on hand-exported files.

Usage:
    python3 scripts/make-app-theme-icons.py [--masters DIR] [--res DIR]
                                            [--web DIR] [--generate-masters]

Requires Pillow (make-masters also uses numpy when it is available).
"""

import argparse
import sys
from pathlib import Path

try:
    from PIL import Image, ImageDraw
except ImportError:  # pragma: no cover - build-time guard
    sys.exit("error: Pillow is required (pip install pillow)")

# (suffix, background, accent) -- suffix 1..5 are the alternate themes.
THEMES = [
    ("default", (250, 244, 234), (201, 162, 39)),   # Default (the app's cream)
    ("theme1", (253, 252, 249), (185, 154, 107)),   # Light
    ("theme2", (217, 230, 247), (74, 127, 212)),    # Blue
    ("theme3", (220, 239, 226), (61, 122, 90)),     # Sage
    ("theme4", (252, 235, 203), (176, 115, 58)),    # Amber
    ("theme5", (251, 225, 233), (194, 107, 138)),   # Pink
]
STYLES = ["style1", "style2"]

# density: legacy launcher size in px (48dp)
DENSITIES = {"mdpi": 48, "hdpi": 72, "xhdpi": 96, "xxhdpi": 144, "xxxhdpi": 192}
# An adaptive icon draws on a 108dp canvas and only the inner 72dp is visible.
ADAPTIVE_DP = 108
VISIBLE_DP = 72
MASTER_SIZE = 512
ROUND_DP = 48


def icon_names():
    return ["%s_%s" % (style, theme) for style in STYLES for theme, _, _ in THEMES]


def master_path(masters, name):
    """The master for a variant; an upload may be a .jpg instead of a .png."""
    base = Path(masters)
    for suffix in (".png", ".jpg", ".jpeg"):
        candidate = base / (name + suffix)
        if candidate.exists():
            return candidate
    return base / (name + ".png")


def dotted(size, mode="RGBA"):
    return Image.new(mode, (size, size), (0, 0, 0, 0))


def mix(a, b, t):
    return tuple(int(round(a[i] + (b[i] - a[i]) * t)) for i in range(3))


def recolor_background(img, colour, keep_alpha=True):
    """Replaces the cream backdrop with ``colour``, keeping its soft shading.

    The book and the bulb are dark/saturated, so a light low-chroma test picks
    out the backdrop without touching the artwork.
    """
    img = img.convert("RGBA")
    try:
        import numpy as np
    except ImportError:
        return _recolor_slow(img, colour)
    data = np.asarray(img).astype(np.float32)
    r, g, b = data[:, :, 0], data[:, :, 1], data[:, :, 2]
    brightest = np.maximum(np.maximum(r, g), b)
    darkest = np.minimum(np.minimum(r, g), b)
    cream = (r > 215) & (g > 205) & (b > 190) & ((brightest - darkest) < 34)
    lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255.0
    shade = np.clip(lum / 0.955, 0.0, 1.0)
    out = data.copy()
    for i, channel in enumerate(colour):
        replaced = np.clip(channel * shade, 0, 255)
        out[:, :, i] = np.where(cream, replaced, data[:, :, i])
    if not keep_alpha:
        out[:, :, 3] = 255
    return Image.fromarray(out.astype("uint8"), "RGBA")


def _recolor_slow(img, colour):  # pragma: no cover - numpy is the normal path
    px = img.load()
    w, h = img.size
    out = dotted(w)
    op = out.load()
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            hi, lo = max(r, g, b), min(r, g, b)
            if r > 215 and g > 205 and b > 190 and (hi - lo) < 34:
                shade = min(1.0, (0.299 * r + 0.587 * g + 0.114 * b) / 255.0 / 0.955)
                op[x, y] = (
                    int(colour[0] * shade),
                    int(colour[1] * shade),
                    int(colour[2] * shade),
                    a,
                )
            else:
                op[x, y] = (r, g, b, a)
    return out


def circle_mask(size, inset=0):
    mask = Image.new("L", (size * 4, size * 4), 0)
    ImageDraw.Draw(mask).ellipse(
        (inset * 4, inset * 4, size * 4 - 1 - inset * 4, size * 4 - 1 - inset * 4),
        fill=255,
    )
    return mask.resize((size, size), Image.LANCZOS)


def rounded_mask(size, radius_ratio=0.2237):
    mask = Image.new("L", (size * 4, size * 4), 0)
    ImageDraw.Draw(mask).rounded_rectangle(
        (0, 0, size * 4 - 1, size * 4 - 1), radius=int(size * 4 * radius_ratio), fill=255
    )
    return mask.resize((size, size), Image.LANCZOS)


def build_master(base, style, bg, accent):
    """style1 keeps the rounded-square artwork, style2 is a circular badge."""
    art = recolor_background(base, bg)
    size = art.size[0]
    if style == "style1":
        return art

    # Style 2: a circle in a slightly deeper tint with a thin accent rim.
    # Crop the master's rounded-square edge first, otherwise it shows up as a
    # square plate inside the circle.
    deep = mix(bg, accent, 0.16)
    art = recolor_background(base, deep)
    inset = int(size * 0.07)
    art = art.crop((inset, inset, size - inset, size - inset)).resize((size, size), Image.LANCZOS)
    canvas = dotted(size)
    ImageDraw.Draw(canvas).ellipse((0, 0, size - 1, size - 1), fill=deep + (255,))
    canvas.paste(art, (0, 0), circle_mask(size))
    draw = ImageDraw.Draw(canvas)
    rim = max(2, size // 64)
    draw.ellipse(
        (rim // 2, rim // 2, size - 1 - rim // 2, size - 1 - rim // 2),
        outline=accent + (110,),
        width=rim,
    )
    return canvas


def generate_masters(masters, base_icon):
    if not base_icon.exists():
        sys.exit("error: %s not found; add your 12 icon PNGs to %s instead" % (base_icon, masters))
    masters = Path(masters)
    masters.mkdir(parents=True, exist_ok=True)
    base = Image.open(base_icon).convert("RGBA").resize((MASTER_SIZE, MASTER_SIZE), Image.LANCZOS)
    written = 0
    for style in STYLES:
        for theme, bg, accent in THEMES:
            name = "%s_%s" % (style, theme)
            if master_path(masters, name).exists():
                continue  # an upload may be a .jpg, so check every suffix
            path = masters / (name + ".png")
            build_master(base, style, bg, accent).save(path)
            written += 1
    return written


def adaptive_foreground(art, px):
    """The artwork inside the 108dp adaptive canvas (only 72dp is visible)."""
    canvas = dotted(px)
    inner = max(1, int(round(px * VISIBLE_DP / ADAPTIVE_DP)))
    offset = (px - inner) // 2
    canvas.paste(art.resize((inner, inner), Image.LANCZOS), (offset, offset))
    return canvas


def background_colour(art):
    """The artwork's own backdrop, so the adaptive mask blends into it."""
    width, height = art.size
    sample = art.convert("RGB").getpixel((width // 2, max(1, height // 24)))
    if sum(sample) < 12:  # fully transparent/corner pixel: try the centre edge
        sample = art.convert("RGB").getpixel((width // 2, height // 2))
    return "#%02X%02X%02X" % sample


def render_res(masters, res):
    """Writes every launcher density for the 12 themes (plus round variants)."""
    res = Path(res)
    adaptive_dir = res / "mipmap-anydpi-v26"
    adaptive_dir.mkdir(parents=True, exist_ok=True)
    for name in icon_names():
        src = master_path(masters, name)
        art = Image.open(src).convert("RGBA")
        side = min(art.size)
        if art.size[0] != art.size[1]:
            left = (art.size[0] - side) // 2
            top = (art.size[1] - side) // 2
            art = art.crop((left, top, left + side, top + side))
        tint = background_colour(art)

        for density, px in DENSITIES.items():
            folder = res / ("mipmap-" + density)
            folder.mkdir(parents=True, exist_ok=True)
            scaled = art.resize((px, px), Image.LANCZOS)
            outs = []
            if name == "style1_default":
                outs.append((folder / "ic_launcher.png", scaled))
                outs.append((folder / "ic_launcher_round.png", _round(scaled)))
            outs.append((folder / ("ic_launcher_%s.png" % name), scaled))
            outs.append((folder / ("ic_launcher_%s_round.png" % name), _round(scaled)))
            outs.append((folder / ("ic_launcher_%s_foreground.png" % name),
                         adaptive_foreground(scaled, int(round(px * ADAPTIVE_DP / 48)))))
            for path, image in outs:
                image.save(path)

        (res / "values").mkdir(parents=True, exist_ok=True)
        (res / "values" / ("ic_launcher_%s_colors.xml" % name)).write_text(
            '<?xml version="1.0" encoding="utf-8"?>\n'
            "<resources>\n"
            '    <color name="ic_launcher_%s_background">%s</color>\n'
            "</resources>\n" % (name, tint),
            encoding="utf-8",
        )

        icon_xml = (
            '<?xml version="1.0" encoding="utf-8"?>\n'
            "<adaptive-icon xmlns:android=\"http://schemas.android.com/apk/res/android\">\n"
            '    <background android:drawable="@color/ic_launcher_%s_background" />\n'
            '    <foreground android:drawable="@mipmap/ic_launcher_%s_foreground" />\n'
            "</adaptive-icon>\n" % (name, name)
        )
        targets = [adaptive_dir / ("ic_launcher_%s.xml" % name)]
        if name == "style1_default":
            # The shipped icon is style1_default: keep the adaptive entries in
            # sync so the default launcher entry is not a different picture.
            targets.append(adaptive_dir / "ic_launcher.xml")
            targets.append(adaptive_dir / "ic_launcher_round.xml")
        for target in targets:
            target.write_text(icon_xml, encoding="utf-8")


def _round(img):
    size = img.size[0]
    out = dotted(size)
    out.paste(img, (0, 0), circle_mask(size))
    return out


def copy_web(masters, web):
    web = Path(web)
    web.mkdir(parents=True, exist_ok=True)
    for name in icon_names():
        src = master_path(masters, name)
        art = Image.open(src).convert("RGBA")
        art.resize((256, 256), Image.LANCZOS).save(web / (name + ".png"))


def main():
    here = Path(__file__).resolve().parent
    root = here.parent
    parser = argparse.ArgumentParser()
    parser.add_argument("--masters", default=str(root / "resources/android/custom-icons"))
    parser.add_argument("--res", default=str(root / "android/app/src/main/res"))
    parser.add_argument("--web", default=str(root / "icons/app-themes"))
    parser.add_argument("--base-icon", default=str(root / "icons/icon-499.png"))
    parser.add_argument("--generate-masters", action="store_true")
    args = parser.parse_args()

    if args.generate_masters:
        made = generate_masters(args.masters, Path(args.base_icon))
        if made:
            print("Generated %d theme icon masters in %s" % (made, args.masters))

    missing = [n for n in icon_names() if not master_path(args.masters, n).exists()]
    if missing:
        sys.exit("error: missing icon masters in %s: %s" % (args.masters, ", ".join(missing)))

    render_res(args.masters, args.res)
    copy_web(args.masters, args.web)
    print("App icon themes rendered: %d masters -> mipmaps + %s" % (len(icon_names()), args.web))


if __name__ == "__main__":
    main()
