package com.jajax.studyspace;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.graphics.RectF;
import android.os.Build;
import android.os.Bundle;
import android.text.format.DateFormat;
import android.view.View;
import android.widget.RemoteViews;

import java.util.Date;
import java.util.Locale;

/**
 * Exam countdown home screen widget.
 *
 * The web app writes the selected exam into SharedPreferences through
 * {@link WidgetBridge}: its title, its subject, the exact target instant as a
 * Unix epoch timestamp in milliseconds, and the colours of the theme currently
 * selected in the app. This provider does all of the maths and all of the
 * colouring, so the widget keeps ticking and stays in the app's theme even when
 * the app is closed.
 *
 * A one minute {@link AlarmManager} alarm (RTC, so it never wakes a sleeping
 * device) plus the launcher's updatePeriodMillis keep the numbers live.
 */
public class ExamCountdownWidgetProvider extends AppWidgetProvider {

    public static final String PREFS = "studyspace_widget";
    public static final String KEY_ENABLED = "enabled";
    public static final String KEY_SIZE = "size";
    public static final String KEY_EXAM = "examId";
    public static final String KEY_TITLE = "title";
    public static final String KEY_AT = "at";
    public static final String KEY_SUBJ = "subj";
    public static final String KEY_SYNCED = "synced";
    public static final String KEY_THEME_CARD = "themeCard";
    public static final String KEY_THEME_LINE = "themeLine";
    public static final String KEY_THEME_INK = "themeInk";
    public static final String KEY_THEME_MUTED = "themeMuted";
    public static final String KEY_THEME_ACCENT = "themeAccent";

    public static final String ACTION_REFRESH = "com.jajax.studyspace.WIDGET_REFRESH";
    private static final int REFRESH_RC = 4711;
    private static final int OPEN_RC = 4712;
    private static final long TICK_MS = 60000L;

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        updateAll(context);
        scheduleNextRefresh(context);
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        super.onReceive(context, intent);
        String action = intent == null ? null : intent.getAction();
        if (ACTION_REFRESH.equals(action)
                || Intent.ACTION_BOOT_COMPLETED.equals(action)
                || Intent.ACTION_TIME_CHANGED.equals(action)
                || Intent.ACTION_TIME_TICK.equals(action)
                || Intent.ACTION_TIMEZONE_CHANGED.equals(action)
                || Intent.ACTION_DATE_CHANGED.equals(action)
                || Intent.ACTION_USER_PRESENT.equals(action)
                || Intent.ACTION_SCREEN_ON.equals(action)
                || Intent.ACTION_MY_PACKAGE_REPLACED.equals(action)) {
            updateAll(context);
            scheduleNextRefresh(context);
        }
    }

    @Override
    public void onEnabled(Context context) {
        updateAll(context);
        scheduleNextRefresh(context);
    }

    @Override
    public void onDisabled(Context context) {
        cancelRefresh(context);
    }

    /** Redraws every placed widget and re-arms the ticking alarm. */
    public static void refresh(Context context) {
        updateAll(context);
        scheduleNextRefresh(context);
    }

    public static void updateAll(Context context) {
        try {
            AppWidgetManager manager = AppWidgetManager.getInstance(context);
            ComponentName name = new ComponentName(context, ExamCountdownWidgetProvider.class);
            int[] ids = manager.getAppWidgetIds(name);
            for (int id : ids) {
                updateWidget(context, manager, id);
            }
        } catch (Exception ignored) {
        }
    }

    private static void updateWidget(Context context, AppWidgetManager manager, int widgetId) {
        SharedPreferences sp = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        boolean enabled = sp.getBoolean(KEY_ENABLED, false);
        String size = sp.getString(KEY_SIZE, "medium");
        String title = sp.getString(KEY_TITLE, "");
        String subject = sp.getString(KEY_SUBJ, "");
        long at = sp.getLong(KEY_AT, 0L);

        int layout;
        boolean compact = "small".equals(size);
        boolean large = "large".equals(size);
        if (compact) {
            layout = R.layout.widget_small;
        } else if (large) {
            layout = R.layout.widget_large;
        } else {
            layout = R.layout.widget_medium;
        }

        RemoteViews views;
        try {
            views = new RemoteViews(context.getPackageName(), layout);
        } catch (Exception e) {
            return;
        }

        applyTheme(context, manager, widgetId, views, sp);

        boolean hasExam = enabled && at > 0L && title.length() > 0;
        long now = System.currentTimeMillis();
        long diff = at - now;

        // Reset everything first so a stale state never leaks between redraws.
        views.setViewVisibility(R.id.w_tm, hasExam ? View.VISIBLE : View.GONE);
        views.setViewVisibility(R.id.w_when, hasExam ? View.VISIBLE : View.GONE);
        views.setViewVisibility(R.id.w_status, View.GONE);
        views.setViewVisibility(R.id.w_hint, hasExam && large ? View.VISIBLE : View.GONE);
        views.setTextViewText(R.id.w_when, "");

        if (!enabled) {
            views.setTextViewText(R.id.w_title, "Exam countdown");
            views.setTextViewText(R.id.w_status, "Widget disabled in app settings");
            views.setViewVisibility(R.id.w_status, View.VISIBLE);
        } else if (at <= 0L || title.length() == 0) {
            views.setTextViewText(R.id.w_title, "No upcoming exam");
            views.setTextViewText(R.id.w_status, "Add an exam in Exam countdown");
            views.setViewVisibility(R.id.w_status, View.VISIBLE);
        } else {
            views.setTextViewText(R.id.w_title, title);
            String when = formatWhen(context, at);
            views.setTextViewText(R.id.w_when,
                    subject.length() > 0 ? subject + " \u00b7 " + when : when);

            long days = 0L;
            long hours = 0L;
            long mins = 0L;
            if (diff > 0L) {
                days = diff / 86400000L;
                hours = (diff % 86400000L) / 3600000L;
                mins = (diff % 3600000L) / 60000L;
            } else {
                views.setTextViewText(R.id.w_status, "Exam time reached");
                views.setViewVisibility(R.id.w_status, View.VISIBLE);
            }

            if (compact) {
                views.setTextViewText(R.id.w_days, days + "d");
                views.setTextViewText(R.id.w_hours, pad(hours) + "h");
                views.setTextViewText(R.id.w_mins, pad(mins) + "m");
                views.setViewVisibility(R.id.w_dayslabel, View.GONE);
                views.setViewVisibility(R.id.w_hourslabel, View.GONE);
                views.setViewVisibility(R.id.w_minslabel, View.GONE);
                views.setViewVisibility(R.id.w_sep1, View.GONE);
                views.setViewVisibility(R.id.w_sep2, View.GONE);
            } else {
                views.setTextViewText(R.id.w_days, String.valueOf(days));
                views.setTextViewText(R.id.w_hours, pad(hours));
                views.setTextViewText(R.id.w_mins, pad(mins));
                views.setViewVisibility(R.id.w_dayslabel, View.VISIBLE);
                views.setViewVisibility(R.id.w_hourslabel, View.VISIBLE);
                views.setViewVisibility(R.id.w_minslabel, View.VISIBLE);
                views.setViewVisibility(R.id.w_sep1, View.VISIBLE);
                views.setViewVisibility(R.id.w_sep2, View.VISIBLE);
            }
        }

        views.setOnClickPendingIntent(R.id.w_root, openAppIntent(context));
        try {
            manager.updateAppWidget(widgetId, views);
        } catch (Exception ignored) {
        }
    }

    /**
     * Paints the widget in the colours the app currently uses: the card colour
     * becomes a rounded, bordered backdrop, muted text stays muted and the
     * digits use the accent (or the user's countdown colour).
     */
    private static void applyTheme(Context context, AppWidgetManager manager, int widgetId,
                                   RemoteViews views, SharedPreferences sp) {
        try {
            int card = colour(context, sp, KEY_THEME_CARD, R.color.ss_widget_bg);
            int line = colour(context, sp, KEY_THEME_LINE, R.color.ss_widget_border);
            int ink = colour(context, sp, KEY_THEME_INK, R.color.ss_widget_text);
            int muted = colour(context, sp, KEY_THEME_MUTED, R.color.ss_widget_muted);
            int accent = colour(context, sp, KEY_THEME_ACCENT, R.color.ss_widget_accent);

            int[] size = widgetSize(manager, widgetId);
            Bitmap backdrop = cardBitmap(context, size[0], size[1], card, line);
            if (backdrop != null) {
                views.setImageViewBitmap(R.id.w_bg, backdrop);
            } else {
                views.setInt(R.id.w_bg, "setBackgroundColor", card);
            }

            int tile = blend(card, accent, 0.12f);
            views.setInt(R.id.w_seg1, "setBackgroundColor", tile);
            views.setInt(R.id.w_seg2, "setBackgroundColor", tile);
            views.setInt(R.id.w_seg3, "setBackgroundColor", tile);

            views.setTextColor(R.id.w_title, ink);
            views.setTextColor(R.id.w_when, muted);
            views.setTextColor(R.id.w_hint, muted);
            views.setTextColor(R.id.w_dayslabel, muted);
            views.setTextColor(R.id.w_hourslabel, muted);
            views.setTextColor(R.id.w_minslabel, muted);
            views.setTextColor(R.id.w_days, accent);
            views.setTextColor(R.id.w_hours, accent);
            views.setTextColor(R.id.w_mins, accent);
            views.setTextColor(R.id.w_sep1, accent);
            views.setTextColor(R.id.w_sep2, accent);
        } catch (Exception ignored) {
            // A widget placed before an update keeps the bundled theme colours.
        }
    }

    /** Widget size in dp, used to draw a crisp rounded backdrop. */
    private static int[] widgetSize(AppWidgetManager manager, int widgetId) {
        int width = 300;
        int height = 160;
        try {
            Bundle options = manager.getAppWidgetOptions(widgetId);
            if (options != null) {
                int w = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH);
                int h = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT);
                if (w > 0) {
                    width = w;
                }
                if (h > 0) {
                    height = h;
                }
            }
        } catch (Exception ignored) {
        }
        return new int[] { width, height };
    }

    private static Bitmap cardBitmap(Context context, int widthDp, int heightDp, int card, int border) {
        try {
            float density = context.getResources().getDisplayMetrics().density;
            int width = Math.max(1, Math.round(widthDp * density));
            int height = Math.max(1, Math.round(heightDp * density));
            Bitmap bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888);
            Canvas canvas = new Canvas(bitmap);
            float radius = 16f * density;
            float stroke = Math.max(1f, density);
            Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
            paint.setColor(card);
            canvas.drawRoundRect(new RectF(0, 0, width, height), radius, radius, paint);
            if (border != 0) {
                paint.setStyle(Paint.Style.STROKE);
                paint.setStrokeWidth(stroke);
                paint.setColor(border);
                canvas.drawRoundRect(
                        new RectF(stroke / 2f, stroke / 2f, width - stroke / 2f, height - stroke / 2f),
                        radius, radius, paint);
            }
            return bitmap;
        } catch (Exception e) {
            return null;
        }
    }

    private static int blend(int from, int to, float ratio) {
        float r = ratio < 0f ? 0f : (ratio > 1f ? 1f : ratio);
        int a = Math.round(android.graphics.Color.alpha(from)
                + (android.graphics.Color.alpha(to) - android.graphics.Color.alpha(from)) * r);
        int red = Math.round(android.graphics.Color.red(from)
                + (android.graphics.Color.red(to) - android.graphics.Color.red(from)) * r);
        int green = Math.round(android.graphics.Color.green(from)
                + (android.graphics.Color.green(to) - android.graphics.Color.green(from)) * r);
        int blue = Math.round(android.graphics.Color.blue(from)
                + (android.graphics.Color.blue(to) - android.graphics.Color.blue(from)) * r);
        return android.graphics.Color.argb(a, red, green, blue);
    }

    private static int colour(Context context, SharedPreferences sp, String key, int fallback) {
        int parsed = parseHex(sp.getString(key, ""));
        if (parsed != 0) {
            return parsed;
        }
        try {
            if (Build.VERSION.SDK_INT >= 23) {
                return context.getColor(fallback);
            }
            return context.getResources().getColor(fallback);
        } catch (Exception e) {
            return 0;
        }
    }

    static int parseHex(String hex) {
        if (hex == null) {
            return 0;
        }
        String value = hex.trim();
        if (value.startsWith("#")) {
            value = value.substring(1);
        }
        if (value.length() == 3) {
            StringBuilder expanded = new StringBuilder(6);
            for (int i = 0; i < 3; i++) {
                expanded.append(value.charAt(i)).append(value.charAt(i));
            }
            value = expanded.toString();
        }
        if (value.length() != 6) {
            return 0;
        }
        try {
            return 0xFF000000 | (int) Long.parseLong(value, 16);
        } catch (NumberFormatException e) {
            return 0;
        }
    }

    private static String pad(long value) {
        return String.format(Locale.US, "%02d", value);
    }

    private static PendingIntent openAppIntent(Context context) {
        Intent open = new Intent(context, MainActivity.class);
        open.setAction(Intent.ACTION_VIEW);
        open.putExtra("ss_route", "exams");
        open.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP
                | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= 23) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }
        return PendingIntent.getActivity(context, OPEN_RC, open, flags);
    }

    /** Formats the target instant in the device's own time zone and locale. */
    private static String formatWhen(Context context, long at) {
        try {
            Date target = new Date(at);
            String day = DateFormat.getMediumDateFormat(context).format(target);
            String clock = DateFormat.getTimeFormat(context).format(target);
            return day + " \u00b7 " + clock;
        } catch (Exception e) {
            return "";
        }
    }

    /**
     * Re-arms a one minute alarm while a countdown is running. RTC (not
     * RTC_WAKEUP) means the alarm fires as soon as the device is awake, so it
     * costs nothing in deep sleep.
     */
    public static void scheduleNextRefresh(Context context) {
        try {
            SharedPreferences sp = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
            boolean enabled = sp.getBoolean(KEY_ENABLED, false);
            long at = sp.getLong(KEY_AT, 0L);
            AlarmManager am = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
            if (am == null) {
                return;
            }
            PendingIntent pi = refreshIntent(context);
            if (!enabled || at <= System.currentTimeMillis()) {
                am.cancel(pi);
                return;
            }
            am.set(AlarmManager.RTC, System.currentTimeMillis() + TICK_MS, pi);
        } catch (Exception ignored) {
        }
    }

    public static void cancelRefresh(Context context) {
        try {
            AlarmManager am = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
            if (am != null) {
                am.cancel(refreshIntent(context));
            }
        } catch (Exception ignored) {
        }
    }

    private static PendingIntent refreshIntent(Context context) {
        Intent intent = new Intent(context, ExamCountdownWidgetProvider.class);
        intent.setAction(ACTION_REFRESH);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= 23) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }
        return PendingIntent.getBroadcast(context, REFRESH_RC, intent, flags);
    }
}
