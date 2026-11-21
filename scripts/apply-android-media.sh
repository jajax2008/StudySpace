#!/usr/bin/env bash
# StudySpace Group Study voice room permissions
#
# The Android project is generated at build time (`npx cap add android`), so the
# microphone permissions cannot live inside android/ in git. They are added to the
# generated AndroidManifest.xml here, before Gradle builds the APK.
#
# Usage: bash scripts/apply-android-media.sh [android-dir]   (default: android)

set -euo pipefail

APP_DIR="${1:-android}"
MANIFEST="$APP_DIR/app/src/main/AndroidManifest.xml"

if [ ! -f "$MANIFEST" ]; then
  echo "error: '$MANIFEST' was not found. Run 'npx cap add android' first." >&2
  exit 1
fi

python3 - "$MANIFEST" <<'PY'
import io
import sys

path = sys.argv[1]
need = [
    "android.permission.RECORD_AUDIO",
    "android.permission.MODIFY_AUDIO_SETTINGS",
]
text = io.open(path, encoding="utf-8").read()
missing = [n for n in need if ('android:name="%s"' % n) not in text]
if not missing:
    print("microphone permissions already present")
    raise SystemExit(0)

lines = "\n".join('    <uses-permission android:name="%s" />' % n for n in missing)
internet = '<uses-permission android:name="android.permission.INTERNET" />'
if internet in text:
    text = text.replace(internet, lines + "\n" + internet, 1)
else:
    end = text.index("</manifest>")
    text = text[:end] + lines + "\n\n" + text[end:]

io.open(path, "w", encoding="utf-8").write(text)
print("added: " + " ".join(n.rsplit(".", 1)[-1] for n in missing))
PY
