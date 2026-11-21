#!/usr/bin/env bash
# StudySpace app icon themes (2 styles x 6 themes)
#
# The Android project is generated at build time (`npx cap add android`), so the
# launcher icons and the <activity-alias> entries cannot live inside android/ in
# git. The 12 master PNGs are committed under resources/android/custom-icons/
# and everything else is derived from them here:
#
#   1. every mipmap density for ic_launcher (style1_default) and for the 11
#      named icons ic_launcher_style1_theme1 .. ic_launcher_style2_theme5
#   2. icons/app-themes/*.png, the crisp previews the Settings screen shows
#   3. one <activity-alias> per variant in AndroidManifest.xml (default enabled,
#      the other 11 disabled) so the app can switch its home screen icon
#
# Usage: bash scripts/apply-android-icon-themes.sh [android-dir]   (default: android)

set -euo pipefail

APP_DIR="${1:-android}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/.." && pwd)"
MASTERS="$ROOT/resources/android/custom-icons"
RES_DIR="$APP_DIR/app/src/main/res"
MANIFEST="$APP_DIR/app/src/main/AndroidManifest.xml"

if [ ! -d "$APP_DIR" ]; then
  echo "error: '$APP_DIR' was not found. Run 'npx cap add android' first." >&2
  exit 1
fi
if [ ! -f "$MANIFEST" ]; then
  echo "error: missing $MANIFEST" >&2
  exit 1
fi

# Render the mipmaps + web previews (masters are created from icons/icon-499.png
# only when resources/android/custom-icons/ is still empty).
python3 "$HERE/make-app-theme-icons.py" \
  --masters "$MASTERS" \
  --res "$RES_DIR" \
  --web "$ROOT/icons/app-themes" \
  --generate-masters

# Fail the build instead of shipping a half-themed icon set.
missing=0
for name in style1_default style1_theme1 style1_theme2 style1_theme3 style1_theme4 style1_theme5 \
            style2_default style2_theme1 style2_theme2 style2_theme3 style2_theme4 style2_theme5; do
  for d in mdpi hdpi xhdpi xxhdpi xxxhdpi; do
    if [ ! -f "$RES_DIR/mipmap-$d/ic_launcher_$name.png" ]; then
      echo "error: missing mipmap-$d/ic_launcher_$name.png" >&2
      missing=1
    fi
  done
  if [ ! -f "$ROOT/icons/app-themes/$name.png" ]; then
    echo "error: missing icons/app-themes/$name.png" >&2
    missing=1
  fi
done
if [ "$missing" -ne 0 ]; then
  exit 1
fi

python3 - "$MANIFEST" <<'PY'
import re
import sys
import xml.etree.ElementTree as ET

path = sys.argv[1]
with open(path, encoding="utf-8") as fh:
    xml = fh.read()

# style1_default is the primary icon: it is the enabled alias. The other eleven
# start disabled and are enabled by AppIconBridge when the user picks one.
VARIANTS = [
    "style1_default",
    "style1_theme1", "style1_theme2", "style1_theme3", "style1_theme4", "style1_theme5",
    "style2_default",
    "style2_theme1", "style2_theme2", "style2_theme3", "style2_theme4", "style2_theme5",
]

START = "<!-- StudySpace app icon themes (generated) -->"
END = "<!-- /StudySpace app icon themes -->"

blocks = [START]
for name in VARIANTS:
    enabled = "true" if name == "style1_default" else "false"
    blocks.append(
        '        <activity-alias\n'
        '            android:name=".%s"\n'
        '            android:enabled="%s"\n'
        '            android:exported="true"\n'
        '            android:icon="@mipmap/ic_launcher_%s"\n'
        '            android:roundIcon="@mipmap/ic_launcher_%s_round"\n'
        '            android:targetActivity=".MainActivity">\n'
        '            <intent-filter>\n'
        '                <action android:name="android.intent.action.MAIN" />\n'
        '                <category android:name="android.intent.category.LAUNCHER" />\n'
        '            </intent-filter>\n'
        '        </activity-alias>' % (name, enabled, name, name)
    )
blocks.append("        " + END)
section = "\n".join(blocks) + "\n"

if START in xml:
    existing = re.search(re.escape(START) + r".*?" + re.escape(END), xml, re.S)
    if not existing:
        sys.exit("error: found the generated-icon start marker without its end marker")
    xml = xml[: existing.start()] + section.strip("\n") + xml[existing.end():]
else:
    close = xml.rindex("</application>")
    xml = xml[:close] + section + xml[close:]

# Exactly one launcher entry may own MAIN/LAUNCHER, and it must be an alias:
# a launcher <intent-filter> on MainActivity would show a second, unswitched
# icon next to the enabled alias.
activity = re.search(
    r"<activity\b[^>]*android:name=\"\.MainActivity\"[^>]*>(.*?)</activity>",
    xml,
    re.S,
)
if not activity:
    sys.exit("error: no MainActivity declaration found in " + path)
body = activity.group(1)
if "android.intent.category.LAUNCHER" in body:
    body = re.sub(
        r"\s*<intent-filter>\s*<action android:name=\"android.intent.action.MAIN\"\s*/>"
        r"\s*<category android:name=\"android.intent.category.LAUNCHER\"\s*/>\s*</intent-filter>",
        "",
        body,
        flags=re.S,
    )
    if "android.intent.category.LAUNCHER" in body:
        sys.exit("error: could not remove the launcher intent-filter from MainActivity")
    xml = xml[: activity.start(1)] + body + xml[activity.end(1):]

try:
    ET.fromstring(xml)
except ET.ParseError as exc:
    sys.exit("error: AndroidManifest.xml is not valid XML after patching (%s)" % exc)

with open(path, "w", encoding="utf-8") as fh:
    fh.write(xml)
print("AndroidManifest.xml: %d launcher icon aliases installed" % len(VARIANTS))
PY

echo "App icon themes installed:"
ls "$ROOT/icons/app-themes" | sed 's/^/  /'
