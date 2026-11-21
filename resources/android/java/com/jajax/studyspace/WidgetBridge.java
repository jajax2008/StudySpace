package com.jajax.studyspace;

import android.app.Activity;
import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.SharedPreferences;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;

import org.json.JSONObject;

/**
 * Tiny JavaScript bridge for the exam countdown widget.
 *
 * The web app calls window.StudySpaceWidget.sync(json) whenever an exam changes
 * or the widget settings change. It sends the chosen exam and its target instant
 * as an epoch millisecond timestamp; all countdown maths happens in
 * {@link ExamCountdownWidgetProvider}, never in the web layer.
 */
public class WidgetBridge {

    private final Activity activity;
    private final WebView webView;
    private final Handler main = new Handler(Looper.getMainLooper());
    private volatile String pendingRoute;

    public WidgetBridge(Activity activity, WebView webView) {
        this.activity = activity;
        this.webView = webView;
    }

    public void setPendingRoute(String route) {
        pendingRoute = route;
    }

    public void pushRouteToWeb() {
        final WebView view = webView;
        if (view == null) {
            return;
        }
        view.post(new Runnable() {
            @Override
            public void run() {
                view.evaluateJavascript("window.__ssOpenExams&&window.__ssOpenExams()", null);
            }
        });
    }

    @JavascriptInterface
    public boolean isAvailable() {
        return true;
    }

    @JavascriptInterface
    public String getPendingRoute() {
        String route = pendingRoute;
        pendingRoute = null;
        return route == null ? "" : route;
    }

    /** Persists the widget state and broadcasts an immediate widget update. */
    @JavascriptInterface
    public void sync(String json) {
        final boolean enabled;
        try {
            JSONObject data = new JSONObject(json == null ? "{}" : json);
            enabled = data.optBoolean("enabled", false);
            JSONObject theme = data.optJSONObject("theme");
            shared().edit()
                    .putBoolean(ExamCountdownWidgetProvider.KEY_ENABLED, enabled)
                    .putString(ExamCountdownWidgetProvider.KEY_SIZE, sanitizeSize(data.optString("size", "medium")))
                    .putString(ExamCountdownWidgetProvider.KEY_EXAM, data.optString("examId", ""))
                    .putString(ExamCountdownWidgetProvider.KEY_TITLE, data.optString("title", ""))
                    .putLong(ExamCountdownWidgetProvider.KEY_AT, data.optLong("at", 0L))
                    .putString(ExamCountdownWidgetProvider.KEY_SUBJ, data.optString("subj", ""))
                    .putString(ExamCountdownWidgetProvider.KEY_THEME_CARD, colour(theme, "card"))
                    .putString(ExamCountdownWidgetProvider.KEY_THEME_LINE, colour(theme, "line"))
                    .putString(ExamCountdownWidgetProvider.KEY_THEME_INK, colour(theme, "ink"))
                    .putString(ExamCountdownWidgetProvider.KEY_THEME_MUTED, colour(theme, "muted"))
                    .putString(ExamCountdownWidgetProvider.KEY_THEME_ACCENT, colour(theme, "cd"))
                    .putLong(ExamCountdownWidgetProvider.KEY_SYNCED, System.currentTimeMillis())
                    .commit();
        } catch (Exception e) {
            return;
        }
        main.post(new Runnable() {
            @Override
            public void run() {
                if (enabled) {
                    ExamCountdownWidgetProvider.refresh(activity);
                } else {
                    ExamCountdownWidgetProvider.updateAll(activity);
                    ExamCountdownWidgetProvider.cancelRefresh(activity);
                }
            }
        });
    }

    /**
     * Persists the Daily Journal sticky note shown by the sticky note widget and
     * broadcasts an immediate ACTION_APPWIDGET_UPDATE so the home screen redraws
     * without waiting for the launcher's own update period.
     */
    @JavascriptInterface
    public void syncSticky(String json) {
        try {
            JSONObject data = new JSONObject(json == null ? "{}" : json);
            shared().edit()
                    .putString(StickyNoteWidgetProvider.KEY_TEXT, data.optString("text", ""))
                    .putString(StickyNoteWidgetProvider.KEY_COLOR, colourHex(data.optString("color", "")))
                    .putString(StickyNoteWidgetProvider.KEY_INK, colourHex(data.optString("ink", "")))
                    .putLong(StickyNoteWidgetProvider.KEY_EXPIRES, data.optLong("expires", 0L))
                    .putString(StickyNoteWidgetProvider.KEY_SIZE, sanitizeSize(data.optString("size", "medium")))
                    .putLong(StickyNoteWidgetProvider.KEY_SYNCED, System.currentTimeMillis())
                    .commit();
        } catch (Exception e) {
            return;
        }
        main.post(new Runnable() {
            @Override
            public void run() {
                StickyNoteWidgetProvider.updateAll(activity);
                try {
                    Intent update = new Intent(AppWidgetManager.ACTION_APPWIDGET_UPDATE);
                    update.setComponent(new ComponentName(activity, StickyNoteWidgetProvider.class));
                    int[] ids = AppWidgetManager.getInstance(activity)
                            .getAppWidgetIds(new ComponentName(activity, StickyNoteWidgetProvider.class));
                    update.putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, ids);
                    activity.sendBroadcast(update);
                } catch (Exception ignored) {
                }
            }
        });
    }

    /** Shows Android's native "add widget" dialog for the sticky note widget. */
    @JavascriptInterface
    public void requestPinSticky() {
        requestPin(StickyNoteWidgetProvider.class);
    }

    /** Forces a redraw, used when the app resumes from the background. */
    @JavascriptInterface
    public void refresh() {
        main.post(new Runnable() {
            @Override
            public void run() {
                ExamCountdownWidgetProvider.refresh(activity);
            }
        });
    }

    /** Shows Android's native "add widget" dialog when the launcher supports it. */
    @JavascriptInterface
    public void requestPin() {
        requestPin(ExamCountdownWidgetProvider.class);
    }

    private void requestPin(final Class<?> provider) {
        main.post(new Runnable() {
            @Override
            public void run() {
                boolean pinned = false;
                try {
                    if (Build.VERSION.SDK_INT >= 26) {
                        AppWidgetManager manager = AppWidgetManager.getInstance(activity);
                        if (manager.isRequestPinAppWidgetSupported()) {
                            ComponentName name = new ComponentName(activity, provider);
                            pinned = manager.requestPinAppWidget(name, null, null);
                        }
                    }
                } catch (Exception e) {
                    pinned = false;
                }
                final boolean ok = pinned;
                final WebView view = webView;
                if (view != null) {
                    view.post(new Runnable() {
                        @Override
                        public void run() {
                            view.evaluateJavascript("window.__ssWidgetPinned&&window.__ssWidgetPinned(" + ok + ")", null);
                        }
                    });
                }
            }
        });
    }

    /** Keeps only a "#rrggbb" value so a bad string never reaches the widget. */
    private static String colourHex(String value) {
        if (value == null) {
            return "";
        }
        String v = value.trim();
        return v.matches("#[0-9a-fA-F]{6}") ? v : "";
    }

    private SharedPreferences shared() {
        return activity.getSharedPreferences(ExamCountdownWidgetProvider.PREFS, Context.MODE_PRIVATE);
    }

    /** A "#rrggbb" colour from the theme object, or "" when it is missing. */
    private static String colour(JSONObject theme, String key) {
        if (theme == null) {
            return "";
        }
        String value = theme.optString(key, "");
        return value == null ? "" : value.trim();
    }

    private String sanitizeSize(String size) {
        if ("small".equals(size) || "large".equals(size)) {
            return size;
        }
        return "medium";
    }
}
