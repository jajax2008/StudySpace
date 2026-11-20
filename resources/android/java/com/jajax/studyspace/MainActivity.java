package com.jajax.studyspace;

import android.content.Intent;
import android.os.Bundle;
import android.webkit.WebView;

import com.getcapacitor.BridgeActivity;

/**
 * StudySpace Android shell.
 *
 * Registers the exam countdown widget bridge on the Capacitor WebView and opens
 * the Examination Countdown view when the app is started from the widget.
 */
public class MainActivity extends BridgeActivity {

    private WidgetBridge widgetBridge;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        try {
            WebView webView = getBridge().getWebView();
            widgetBridge = new WidgetBridge(this, webView);
            webView.addJavascriptInterface(widgetBridge, "StudySpaceWidget");
            String route = routeOf(getIntent());
            if (route != null) {
                widgetBridge.setPendingRoute(route);
            }
        } catch (Exception ignored) {
        }
    }

    public void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        String route = routeOf(intent);
        if (route == null || widgetBridge == null) {
            return;
        }
        widgetBridge.setPendingRoute(route);
        widgetBridge.pushRouteToWeb();
    }

    @Override
    public void onPause() {
        super.onPause();
        // The user just left the app: recompute the countdown and keep ticking.
        if (widgetBridge != null) {
            widgetBridge.refresh();
        }
    }

    @Override
    public void onResume() {
        super.onResume();
        if (widgetBridge != null) {
            widgetBridge.refresh();
        }
    }

    private String routeOf(Intent intent) {
        if (intent == null) {
            return null;
        }
        String route = intent.getStringExtra("ss_route");
        return route == null || route.length() == 0 ? null : route;
    }
}
