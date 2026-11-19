#!/usr/bin/env bash
# StudySpace launcher icons
#
# The Android project is generated at build time (`npx cap add android`), so the
# custom icons cannot live inside android/ in git. They are committed under
# resources/android/res/ instead and copied into the generated project here.
#
# Usage: bash scripts/apply-android-icons.sh [android-dir]   (default: android)

set -euo pipefail

APP_DIR="${1:-android}"
RES_DIR="$APP_DIR/app/src/main/res"
MANIFEST="$APP_DIR/app/src/main/AndroidManifest.xml"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SRC_DIR="$HERE/../resources/android/res"

if [ ! -d "$APP_DIR" ]; then
  echo "error: '$APP_DIR' was not found. Run 'npx cap add android' first." >&2
  exit 1
fi
if [ ! -d "$SRC_DIR" ]; then
  echo "error: missing icon sources at $SRC_DIR" >&2
  exit 1
fi

cp -R "$SRC_DIR/." "$RES_DIR/"

# Regenerate every density from the single master icon the repo ships, so
# replacing icons/icon-499.png changes the APK icon (the committed mipmaps are
# only a fallback for builds without Pillow).
MASTER_ICON="$HERE/../icons/icon-499.png"
if [ -f "$MASTER_ICON" ]; then
  echo "Rendering launcher icons from $MASTER_ICON"
  python3 "$HERE/make-launcher-icons.py" --icon "$MASTER_ICON" --res "$RES_DIR"
fi

# Fail the build instead of silently shipping Capacitor's default icon.
missing=0
for d in mdpi hdpi xhdpi xxhdpi xxxhdpi; do
  for f in ic_launcher.png ic_launcher_round.png ic_launcher_foreground.png; do
    if [ ! -f "$RES_DIR/mipmap-$d/$f" ]; then
      echo "error: missing mipmap-$d/$f" >&2
      missing=1
    fi
  done
done
for f in ic_launcher.xml ic_launcher_round.xml; do
  if [ ! -f "$RES_DIR/mipmap-anydpi-v26/$f" ]; then
    echo "error: missing mipmap-anydpi-v26/$f" >&2
    missing=1
  fi
done
if [ "$missing" -ne 0 ]; then
  exit 1
fi

# Point <application> at the new icons (Capacitor already does this, but keep it
# guaranteed if the template ever changes).
if [ -f "$MANIFEST" ]; then
  python3 - "$MANIFEST" <<'PY'
import re
import sys
import xml.etree.ElementTree as ET

path = sys.argv[1]
with open(path, encoding="utf-8") as fh:
    xml = fh.read()

# [^<>] keeps the match inside a single tag, even for a malformed manifest.
match = re.search(r"<application\b[^<>]*?/?>", xml)
if not match:
    sys.exit("error: no <application> tag found in " + path)

tag = match.group(0)
original = tag


def set_attr(tag, name, value):
    pattern = re.compile(r"\sandroid:" + name + r'="[^"]*"')
    if pattern.search(tag):
        return pattern.sub(' android:%s="%s"' % (name, value), tag, count=1)
    if tag.endswith("/>"):
        return tag[:-2].rstrip() + ' android:%s="%s"/>' % (name, value)
    return tag[:-1].rstrip() + ' android:%s="%s">' % (name, value)


tag = set_attr(tag, "icon", "@mipmap/ic_launcher")
tag = set_attr(tag, "roundIcon", "@mipmap/ic_launcher_round")

if tag != original:
    updated = xml.replace(original, tag, 1)
    try:
        ET.fromstring(updated)
    except ET.ParseError as exc:
        sys.exit("error: AndroidManifest.xml is not valid XML after patching (%s)" % exc)
    with open(path, "w", encoding="utf-8") as fh:
        fh.write(updated)
    print("AndroidManifest.xml: icon + roundIcon set to the custom launcher icons")
else:
    print("AndroidManifest.xml: already points at the custom launcher icons")
PY
else
  echo "warning: $MANIFEST not found, skipping the manifest check" >&2
fi

echo "Custom launcher icons applied:"
find "$RES_DIR" -name 'ic_launcher*' | sort | sed 's/^/  /'
