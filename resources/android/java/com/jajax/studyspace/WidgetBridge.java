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
 * or the widget settings change. The data is stored in SharedPreferences, which
 * the widget provider reads when it renders.
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

    @JavascriptInterface
    public void sync(String json) {
        final boolean enabled;
        try {
            JSONObject data = new JSONObject(json == null ? "{}" : json);
            shared().edit()
                    .putBoolean(ExamCountdownWidgetProvider.KEY_ENABLED, data.optBoolean("enabled", false))
                    .putString(ExamCountdownWidgetProvider.KEY_SIZE, sanitizeSize(data.optString("size", "medium")))
                    .putString(ExamCountdownWidgetProvider.KEY_TITLE, data.optString("title", ""))
                    .putLong(ExamCountdownWidgetProvider.KEY_AT, data.optLong("at", 0L))
                    .putString(ExamCountdownWidgetProvider.KEY_DATE, data.optString("date", ""))
                    .putString(ExamCountdownWidgetProvider.KEY_TIME, data.optString("time", ""))
                    .putString(ExamCountdownWidgetProvider.KEY_SUBJ, data.optString("subj", ""))
                    .putLong(ExamCountdownWidgetProvider.KEY_SYNCED, System.currentTimeMillis())
                    .apply();
            enabled = data.optBoolean("enabled", false);
        } catch (Exception e) {
            return;
        }
        main.post(new Runnable() {
            @Override
            public void run() {
                ExamCountdownWidgetProvider.updateAll(activity);
                if (enabled) {
                    ExamCountdownWidgetProvider.scheduleNextRefresh(activity);
                } else {
                    ExamCountdownWidgetProvider.cancelRefresh(activity);
                }
            }
        });
    }

    /** Shows Android's native "add widget" dialog when the launcher supports it. */
    @JavascriptInterface
    public void requestPin() {
        main.post(new Runnable() {
            @Override
            public void run() {
                boolean pinned = false;
                try {
                    if (Build.VERSION.SDK_INT >= 26) {
                        AppWidgetManager manager = AppWidgetManager.getInstance(activity);
                        if (manager.isRequestPinAppWidgetSupported()) {
                            ComponentName name = new ComponentName(activity, ExamCountdownWidgetProvider.class);
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

    private SharedPreferences shared() {
        return activity.getSharedPreferences(ExamCountdownWidgetProvider.PREFS, Context.MODE_PRIVATE);
    }

    private String sanitizeSize(String size) {
        if ("small".equals(size) || "large".equals(size)) {
            return size;
        }
        return "medium";
    }
}
