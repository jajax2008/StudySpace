package com.jajax.studyspace;

import android.app.Activity;
import android.content.ComponentName;
import android.content.Context;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.webkit.JavascriptInterface;

/**
 * Home screen icon switcher.
 *
 * Every icon variant is a launcher &lt;activity-alias&gt; pointing at
 * {@link MainActivity}; this bridge enables exactly one of them. The alias names
 * match the web app's icon state: style1_default .. style2_theme5, with
 * "default" accepted as a shortcut for style1_default.
 *
 * The JS layer calls the Capawesome AppIcon plugin when it is installed and
 * falls back to window.StudySpaceIcon (this class) otherwise.
 */
public class AppIconBridge {

    public static final String PREFS = "studyspace_icon";
    public static final String KEY_ICON = "icon";

    private static final String DEFAULT_ICON = "style1_default";

    private static final String[] VARIANTS = {
            "style1_default",
            "style1_theme1", "style1_theme2", "style1_theme3", "style1_theme4", "style1_theme5",
            "style2_default",
            "style2_theme1", "style2_theme2", "style2_theme3", "style2_theme4", "style2_theme5",
    };

    private final Activity activity;

    public AppIconBridge(Activity activity) {
        this.activity = activity;
    }

    @JavascriptInterface
    public boolean isAvailable() {
        return true;
    }

    @JavascriptInterface
    public String getCurrentIcon() {
        String saved = prefs().getString(KEY_ICON, DEFAULT_ICON);
        return DEFAULT_ICON.equals(saved) ? "default" : saved;
    }

    /** Enables the alias for {@code name} and disables the other eleven. */
    @JavascriptInterface
    public boolean setIcon(String name) {
        final String icon = normalize(name);
        try {
            PackageManager pm = activity.getPackageManager();
            String pkg = activity.getPackageName();
            for (String variant : VARIANTS) {
                int state = variant.equals(icon)
                        ? PackageManager.COMPONENT_ENABLED_STATE_ENABLED
                        : PackageManager.COMPONENT_ENABLED_STATE_DISABLED;
                pm.setComponentEnabledSetting(
                        new ComponentName(pkg, pkg + "." + variant),
                        state,
                        PackageManager.DONT_KILL_APP);
            }
            prefs().edit().putString(KEY_ICON, icon).commit();
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    /** Restores the icon the app ships with. */
    @JavascriptInterface
    public boolean resetIcon() {
        return setIcon("default");
    }

    private static String normalize(String name) {
        String value = name == null ? "" : name.trim();
        if (value.length() == 0 || "default".equals(value)) {
            return DEFAULT_ICON;
        }
        for (String variant : VARIANTS) {
            if (variant.equals(value)) {
                return variant;
            }
        }
        return DEFAULT_ICON;
    }

    private SharedPreferences prefs() {
        return activity.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }
}
