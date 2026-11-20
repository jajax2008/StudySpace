#!/usr/bin/env bash
# StudySpace exam countdown widget
#
# The Android project is generated at build time (`npx cap add android`), so the
# native widget sources cannot live inside android/ in git. They are committed
# under resources/android/ instead and copied into the generated project here.
#
# Usage: bash scripts/apply-android-widget.sh [android-dir]   (default: android)

set -euo pipefail

APP_DIR="${1:-android}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SRC_DIR="$HERE/../resources/android"
JAVA_SRC="$SRC_DIR/java/com/jajax/studyspace"
RES_SRC="$SRC_DIR/widget-res"
RES_DIR="$APP_DIR/app/src/main/res"
MANIFEST="$APP_DIR/app/src/main/AndroidManifest.xml"
CONFIG="$HERE/../capacitor.config.json"

if [ ! -d "$APP_DIR" ]; then
  echo "error: '$APP_DIR' was not found. Run 'npx cap add android' first." >&2
  exit 1
fi
if [ ! -f "$MANIFEST" ]; then
  echo "error: missing $MANIFEST" >&2
  exit 1
fi
if [ ! -d "$JAVA_SRC" ] || [ ! -d "$RES_SRC" ]; then
  echo "error: missing widget sources under $SRC_DIR" >&2
  exit 1
fi

APP_ID="$(python3 - "$CONFIG" <<'PY'
import json
import sys

with open(sys.argv[1], encoding="utf-8") as fh:
    print(json.load(fh).get("appId", "com.jajax.studyspace"))
PY
)"

if [ "$APP_ID" != "com.jajax.studyspace" ]; then
  echo "error: the widget Java sources are written for com.jajax.studyspace, but appId is '$APP_ID'." >&2
  echo "       Update the package line in resources/android/java/ and this check together." >&2
  exit 1
fi

JAVA_DIR="$APP_DIR/app/src/main/java/com/jajax/studyspace"
mkdir -p "$JAVA_DIR"

# Overwrite the generated MainActivity with the widget-aware one and add the
# provider + bridge. Copying the whole directory keeps this idempotent.
cp "$JAVA_SRC"/*.java "$JAVA_DIR/"

cp -R "$RES_SRC/." "$RES_DIR/"

python3 - "$MANIFEST" <<'PY'
import re
import sys
import xml.etree.ElementTree as ET

path = sys.argv[1]
with open(path, encoding="utf-8") as fh:
    xml = fh.read()

original = xml

PERMISSION = '\n    <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED" />'

RECEIVER = """
        <receiver
            android:name=".ExamCountdownWidgetProvider"
            android:exported="true"
            android:label="@string/ss_widget_title">
            <intent-filter>
                <action android:name="android.appwidget.action.APPWIDGET_UPDATE" />
                <action android:name="com.jajax.studyspace.WIDGET_REFRESH" />
                <action android:name="android.intent.action.BOOT_COMPLETED" />
                <action android:name="android.intent.action.TIME_SET" />
                <action android:name="android.intent.action.TIMEZONE_CHANGED" />
                <action android:name="android.intent.action.DATE_CHANGED" />
            </intent-filter>
            <meta-data
                android:name="android.appwidget.provider"
                android:resource="@xml/exam_countdown_widget_info" />
        </receiver>
"""

if "android.permission.RECEIVE_BOOT_COMPLETED" not in xml:
    manifest_tag = re.search(r"<manifest\b[^>]*>", xml)
    if not manifest_tag:
        sys.exit("error: no <manifest> tag found in " + path)
    xml = xml[: manifest_tag.end()] + PERMISSION + xml[manifest_tag.end():]

if "ExamCountdownWidgetProvider" not in xml:
    close = xml.rindex("</application>")
    xml = xml[:close] + RECEIVER + xml[close:]

# Keep a second tap on the widget inside the existing Activity so it can open
# the Examination Countdown view instead of restarting the web app.
activity = re.search(r'<activity\b[^>]*android:name="\.MainActivity"[^>]*>', xml)
if not activity:
    sys.exit("error: no MainActivity declaration found in " + path)
tag = activity.group(0)
if "android:launchMode" in tag:
    tag = re.sub(r'\sandroid:launchMode="[^"]*"', ' android:launchMode="singleTop"', tag, count=1)
else:
    tag = tag[:-1].rstrip() + ' android:launchMode="singleTop">'
xml = xml.replace(activity.group(0), tag, 1)

if xml != original:
    try:
        ET.fromstring(xml)
    except ET.ParseError as exc:
        sys.exit("error: AndroidManifest.xml is not valid XML after patching (%s)" % exc)
    with open(path, "w", encoding="utf-8") as fh:
        fh.write(xml)
    print("AndroidManifest.xml: widget receiver, boot permission and singleTop launch mode added")
else:
    print("AndroidManifest.xml: widget entries already present")
PY

for f in layout/widget_small.xml layout/widget_medium.xml layout/widget_large.xml \
         drawable/widget_bg.xml xml/exam_countdown_widget_info.xml; do
  if [ ! -f "$RES_DIR/$f" ]; then
    echo "error: $RES_DIR/$f is missing after the copy" >&2
    exit 1
  fi
done

echo "Exam countdown widget installed:"
find "$JAVA_DIR" -name '*.java' | sort | sed 's/^/  /'
find "$RES_DIR" -name 'widget_*.xml' | sort | sed 's/^/  /'
