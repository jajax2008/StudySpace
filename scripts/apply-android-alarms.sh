#!/usr/bin/env bash
# StudySpace Calendar alarms (Capacitor Local Notifications)
#
# The Android project is generated at build time (`npx cap add android`), so the
# alarm permissions and the notification icons cannot live inside android/ in
# git. They are added to the generated project here, before Gradle builds.
#
#   1. SCHEDULE_EXACT_ALARM  -> reminders fire on the exact minute
#   2. USE_FULL_SCREEN_INTENT -> the alarm can wake a locked screen
#   3. WAKE_LOCK / VIBRATE    -> the phone wakes and vibrates like an alarm clock
#   4. POST_NOTIFICATIONS     -> Android 13+ notification permission
#   5. drawable/ic_stat_studyspace  -> the white status bar mark
#   6. drawable-xxhdpi/ic_notify_<style>_<theme>.png -> the equipped launcher
#      icon, used as the large icon so the notification matches the app icon
#
# Usage: bash scripts/apply-android-alarms.sh [android-dir]   (default: android)

set -euo pipefail

APP_DIR="${1:-android}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/.." && pwd)"
MANIFEST="$APP_DIR/app/src/main/AndroidManifest.xml"
RES="$APP_DIR/app/src/main/res"

if [ ! -f "$MANIFEST" ]; then
  echo "error: '$MANIFEST' was not found. Run 'npx cap add android' first." >&2
  exit 1
fi

python3 - "$MANIFEST" <<'PY'
import io
import sys

path = sys.argv[1]
need = [
    "android.permission.SCHEDULE_EXACT_ALARM",
    "android.permission.USE_FULL_SCREEN_INTENT",
    "android.permission.WAKE_LOCK",
    "android.permission.VIBRATE",
    "android.permission.POST_NOTIFICATIONS",
]
text = io.open(path, encoding="utf-8").read()
missing = [n for n in need if ('android:name="%s"' % n) not in text]
if not missing:
    print("alarm permissions already present")
    raise SystemExit(0)

lines = "\n".join('    <uses-permission android:name="%s" />' % n for n in missing)
anchor = "<application"
idx = text.index(anchor)
text = text[:idx] + lines + "\n\n    " + text[idx:]
io.open(path, "w", encoding="utf-8").write(text)
print("added alarm permissions: " + ", ".join(missing))
PY

python3 - "$RES" <<'PY'
import os
import sys

res = sys.argv[1]
drawable = os.path.join(res, "drawable")
os.makedirs(drawable, exist_ok=True)

vector = '''<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="24dp"
    android:height="24dp"
    android:viewportWidth="24"
    android:viewportHeight="24">
    <path
        android:fillColor="#FFFFFFFF"
        android:pathData="M4,5.2c2.7,-0.9 5.4,-0.9 8,0.6c2.6,-1.5 5.3,-1.5 8,-0.6v13c-2.7,-0.9 -5.4,-0.9 -8,0.6c-2.6,-1.5 -5.3,-1.5 -8,-0.6z" />
    <path
        android:fillColor="#FFFFFFFF"
        android:pathData="M11.55,5.85h0.9v13h-0.9z" />
</vector>
'''
with open(os.path.join(drawable, "ic_stat_studyspace.xml"), "w", encoding="utf-8") as fh:
    fh.write(vector)

variants = ["style1_default"] + ["style1_theme%d" % i for i in range(1, 6)] + \
           ["style2_default"] + ["style2_theme%d" % i for i in range(1, 6)]
src_dir = os.path.join(res, "mipmap-xxxhdpi")
out_dir = os.path.join(res, "drawable-xxhdpi")
os.makedirs(out_dir, exist_ok=True)

made = 0
for name in variants:
    src = os.path.join(src_dir, "ic_launcher_%s.png" % name)
    if not os.path.isfile(src):
        continue
    dst = os.path.join(out_dir, "ic_notify_%s.png" % name)
    try:
        from PIL import Image
        img = Image.open(src).convert("RGBA").resize((96, 96), Image.LANCZOS)
        img.save(dst, "PNG", optimize=True)
    except Exception:
        import shutil
        shutil.copyfile(src, dst)
    made += 1

print("notification drawables ready (%d themed icons)" % made)
PY

echo "Calendar alarm support applied to $APP_DIR"
