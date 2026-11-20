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

import java.text.SimpleDateFormat;
import java.util.Calendar;
import java.util.Date;
import java.util.Locale;

/**
 * Exam countdown home screen widget.
 *
 * The web app writes the next upcoming exam into SharedPreferences through
 * {@link WidgetBridge}. This provider renders it and keeps the day count correct
 * with the launcher's periodic update plus a midnight alarm.
 */
public class ExamCountdownWidgetProvider extends AppWidgetProvider {

    public static final String PREFS = "studyspace_widget";
    public static final String KEY_ENABLED = "enabled";
    public static final String KEY_SIZE = "size";
    public static final String KEY_TITLE = "title";
    public static final String KEY_AT = "at";
    public static final String KEY_DATE = "date";
    public static final String KEY_TIME = "time";
    public static final String KEY_SUBJ = "subj";
    public static final String KEY_SYNCED = "synced";

    public static final String ACTION_REFRESH = "com.jajax.studyspace.WIDGET_REFRESH";
    private static final int REFRESH_RC = 4711;
    private static final int OPEN_RC = 4712;

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        for (int id : appWidgetIds) {
            updateWidget(context, appWidgetManager, id);
        }
        scheduleNextRefresh(context);
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        super.onReceive(context, intent);
        String action = intent == null ? null : intent.getAction();
        if (ACTION_REFRESH.equals(action)
                || Intent.ACTION_BOOT_COMPLETED.equals(action)
                || Intent.ACTION_TIME_CHANGED.equals(action)
                || Intent.ACTION_TIMEZONE_CHANGED.equals(action)
                || Intent.ACTION_DATE_CHANGED.equals(action)) {
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
        long at = sp.getLong(KEY_AT, 0L);
        String date = sp.getString(KEY_DATE, "");
        String time = sp.getString(KEY_TIME, "08:00");

        int layout;
        if ("small".equals(size)) {
            layout = R.layout.widget_small;
        } else if ("large".equals(size)) {
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

        long now = System.currentTimeMillis();
        long diff = at - now;

        if (!enabled) {
            views.setTextViewText(R.id.w_title, "Exam countdown");
            views.setTextViewText(R.id.w_when, "");
            views.setTextViewText(R.id.w_status, "Widget disabled in app settings");
            views.setViewVisibility(R.id.w_status, View.VISIBLE);
            views.setViewVisibility(R.id.w_days, View.INVISIBLE);
            views.setViewVisibility(R.id.w_dayslabel, View.INVISIBLE);
            views.setViewVisibility(R.id.w_hours, View.INVISIBLE);
            views.setViewVisibility(R.id.w_when, View.GONE);
        } else if (at <= 0 || title.length() == 0) {
            views.setTextViewText(R.id.w_title, "No upcoming exam");
            views.setTextViewText(R.id.w_when, "");
            views.setTextViewText(R.id.w_status, "Open StudySpace to add an exam date");
            views.setViewVisibility(R.id.w_status, View.VISIBLE);
            views.setViewVisibility(R.id.w_days, View.INVISIBLE);
            views.setViewVisibility(R.id.w_dayslabel, View.INVISIBLE);
            views.setViewVisibility(R.id.w_hours, View.INVISIBLE);
            views.setViewVisibility(R.id.w_when, View.GONE);
        } else {
            long days = diff > 0 ? diff / 86400000L : 0L;
            long hours = diff > 0 ? (diff % 86400000L) / 3600000L : 0L;
            long minutes = diff > 0 ? (diff % 3600000L) / 60000L : 0L;

            views.setTextViewText(R.id.w_title, title);
            views.setTextViewText(R.id.w_when, formatWhen(context, date, time));
            views.setViewVisibility(R.id.w_when, View.VISIBLE);
            views.setViewVisibility(R.id.w_status, View.GONE);

            views.setTextViewText(R.id.w_days, String.valueOf(days));
            if (diff <= 0) {
                views.setTextViewText(R.id.w_dayslabel, "passed");
                views.setTextViewText(R.id.w_hours, "Exam date is over");
            } else {
                views.setTextViewText(R.id.w_dayslabel, days == 1 ? "day left" : "days left");
                views.setTextViewText(R.id.w_hours, hours + "h " + minutes + "m left");
            }
            views.setViewVisibility(R.id.w_days, View.VISIBLE);
            views.setViewVisibility(R.id.w_dayslabel, View.VISIBLE);
            views.setViewVisibility(R.id.w_hours, View.VISIBLE);
        }

        views.setOnClickPendingIntent(R.id.w_root, openAppIntent(context));
        try {
            manager.updateAppWidget(widgetId, views);
        } catch (Exception ignored) {
        }
    }

    private static PendingIntent openAppIntent(Context context) {
        Intent open = new Intent(context, MainActivity.class);
        open.setAction(Intent.ACTION_VIEW);
        open.putExtra("ss_route", "exams");
        open.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= 23) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }
        return PendingIntent.getActivity(context, OPEN_RC, open, flags);
    }

    private static String formatWhen(Context context, String date, String time) {
        if (date == null || date.length() == 0) {
            return "";
        }
        try {
            SimpleDateFormat in = new SimpleDateFormat("yyyy-MM-dd HH:mm", Locale.US);
            Date parsed = in.parse(date + " " + (time == null || time.length() == 0 ? "08:00" : time));
            if (parsed == null) {
                return date;
            }
            String day = DateFormat.getMediumDateFormat(context).format(parsed);
            String clock = DateFormat.getTimeFormat(context).format(parsed);
            return day + " \u00b7 " + clock;
        } catch (Exception e) {
            return date;
        }
    }

    public static void scheduleNextRefresh(Context context) {
        try {
            AlarmManager am = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
            if (am == null) {
                return;
            }
            PendingIntent pi = refreshIntent(context);
            Calendar next = Calendar.getInstance();
            next.add(Calendar.DAY_OF_YEAR, 1);
            next.set(Calendar.HOUR_OF_DAY, 0);
            next.set(Calendar.MINUTE, 0);
            next.set(Calendar.SECOND, 10);
            next.set(Calendar.MILLISECOND, 0);
            am.setWindow(AlarmManager.RTC, next.getTimeInMillis(), 60000L, pi);
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
