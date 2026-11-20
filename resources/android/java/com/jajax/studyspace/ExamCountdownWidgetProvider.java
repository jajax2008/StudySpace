package com.jajax.studyspace;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.text.format.DateFormat;
import android.view.View;
import android.widget.RemoteViews;

import java.util.Date;
import java.util.Locale;

/**
 * Exam countdown home screen widget.
 *
 * The web app writes the selected exam into SharedPreferences through
 * {@link WidgetBridge}: its title, its subject and the exact target instant as a
 * Unix epoch timestamp in milliseconds. This provider does all of the maths, so
 * the widget keeps ticking on its own even when the app is closed.
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
