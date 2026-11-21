package com.jajax.studyspace;

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
import android.util.TypedValue;
import android.widget.RemoteViews;

import java.util.Locale;

/**
 * Sticky note home screen widget.
 *
 * The web app writes the chosen Daily Journal note into SharedPreferences
 * through {@link WidgetBridge#syncSticky(String)}: its text, its paper and ink
 * colours, when it expires, and the widget size. This provider draws that note
 * on a rounded paper card and formats the remaining duration itself, so the
 * widget stays correct even when the app is closed.
 *
 * Expiry is evaluated on every update: a note past its expiry date renders the
 * "no note selected" state instead of stale text.
 */
public class StickyNoteWidgetProvider extends AppWidgetProvider {

    public static final String PREFS = "studyspace_widget";
    public static final String KEY_TEXT = "noteText";
    public static final String KEY_COLOR = "noteColor";
    public static final String KEY_INK = "noteInk";
    public static final String KEY_EXPIRES = "noteExpires";
    public static final String KEY_SIZE = "noteSize";
    public static final String KEY_SYNCED = "noteSynced";

    public static final String ACTION_REFRESH = "com.jajax.studyspace.STICKY_REFRESH";
    private static final int OPEN_RC = 4821;

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        updateAll(context);
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        super.onReceive(context, intent);
        String action = intent == null ? null : intent.getAction();
        if (ACTION_REFRESH.equals(action)
                || Intent.ACTION_BOOT_COMPLETED.equals(action)
                || Intent.ACTION_TIME_CHANGED.equals(action)
                || Intent.ACTION_TIMEZONE_CHANGED.equals(action)
                || Intent.ACTION_DATE_CHANGED.equals(action)
                || Intent.ACTION_MY_PACKAGE_REPLACED.equals(action)) {
            updateAll(context);
        }
    }

    public static void updateAll(Context context) {
        try {
            AppWidgetManager manager = AppWidgetManager.getInstance(context);
            ComponentName name = new ComponentName(context, StickyNoteWidgetProvider.class);
            int[] ids = manager.getAppWidgetIds(name);
            for (int id : ids) {
                updateWidget(context, manager, id);
            }
        } catch (Exception ignored) {
        }
    }

    private static void updateWidget(Context context, AppWidgetManager manager, int widgetId) {
        SharedPreferences sp = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        String size = sp.getString(KEY_SIZE, "medium");
        String text = sp.getString(KEY_TEXT, "");
        long expires = sp.getLong(KEY_EXPIRES, 0L);
        boolean expired = expires > 0L && expires <= System.currentTimeMillis();

        int layout;
        if ("small".equals(size)) {
            layout = R.layout.widget_note_small;
        } else if ("large".equals(size)) {
            layout = R.layout.widget_note_large;
        } else {
            layout = R.layout.widget_note_medium;
        }

        RemoteViews views;
        try {
            views = new RemoteViews(context.getPackageName(), layout);
        } catch (Exception e) {
            return;
        }

        int paper = colour(context, sp.getString(KEY_COLOR, ""), R.color.ss_note_default);
        int ink = colour(context, sp.getString(KEY_INK, ""), R.color.ss_note_default_ink);

        int[] box = widgetSize(manager, widgetId);
        Bitmap backdrop = paperBitmap(context, box[0], box[1], paper, ink);
        if (backdrop != null) {
            views.setImageViewBitmap(R.id.w_note_bg, backdrop);
        } else {
            views.setInt(R.id.w_note_bg, "setBackgroundColor", paper);
        }

        int pad = "small".equals(size) ? 11 : ("large".equals(size) ? 20 : 15);
        float type = "small".equals(size) ? 12f : ("large".equals(size) ? 18f : 14f);
        int density = Math.round(context.getResources().getDisplayMetrics().density);
        views.setViewPadding(R.id.w_note_pad, pad * density, pad * density, pad * density, pad * density);
        views.setTextViewTextSize(R.id.w_note_text, TypedValue.COMPLEX_UNIT_SP, type);
        views.setTextColor(R.id.w_note_text, ink);
        views.setTextColor(R.id.w_note_left, ink);

        boolean hasNote = text != null && text.trim().length() > 0 && !expired;
        if (hasNote) {
            views.setTextViewText(R.id.w_note_text, text.trim());
            views.setTextViewText(R.id.w_note_left, remaining(context, expires));
        } else {
            views.setTextViewText(R.id.w_note_text,
                    context.getString(expired ? R.string.ss_note_expired : R.string.ss_note_empty));
            views.setTextViewText(R.id.w_note_left, "StudySpace");
        }

        views.setOnClickPendingIntent(R.id.w_note_root, openAppIntent(context));
        try {
            manager.updateAppWidget(widgetId, views);
        } catch (Exception ignored) {
        }
    }

    /** "5 days left", "9 hours left" or the permanent label. */
    private static String remaining(Context context, long expires) {
        if (expires <= 0L) {
            return context.getString(R.string.ss_note_permanent);
        }
        long ms = expires - System.currentTimeMillis();
        if (ms <= 0L) {
            return context.getString(R.string.ss_note_expired);
        }
        long hours = ms / 3600000L;
        if (hours < 24L) {
            return String.format(Locale.US, context.getString(R.string.ss_note_hours_left),
                    Math.max(1L, hours));
        }
        return String.format(Locale.US, context.getString(R.string.ss_note_days_left),
                (ms + 86399999L) / 86400000L);
    }

    /** Rounded paper card with a soft 1dp edge in the note's own ink colour. */
    private static Bitmap paperBitmap(Context context, int widthDp, int heightDp, int paper, int ink) {
        try {
            float density = context.getResources().getDisplayMetrics().density;
            int width = Math.max(1, Math.round(widthDp * density));
            int height = Math.max(1, Math.round(heightDp * density));
            Bitmap bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888);
            Canvas canvas = new Canvas(bitmap);
            float radius = 16f * density;
            float stroke = Math.max(1f, density);
            Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
            paint.setColor(paper);
            canvas.drawRoundRect(new RectF(0, 0, width, height), radius, radius, paint);
            paint.setStyle(Paint.Style.STROKE);
            paint.setStrokeWidth(stroke);
            paint.setColor((ink & 0x00FFFFFF) | 0x33000000);
            canvas.drawRoundRect(
                    new RectF(stroke / 2f, stroke / 2f, width - stroke / 2f, height - stroke / 2f),
                    radius, radius, paint);
            return bitmap;
        } catch (Exception e) {
            return null;
        }
    }

    private static int colour(Context context, String hex, int fallback) {
        int parsed = ExamCountdownWidgetProvider.parseHex(hex);
        if (parsed != 0) {
            return parsed;
        }
        try {
            if (Build.VERSION.SDK_INT >= 23) {
                return context.getColor(fallback);
            }
            return context.getResources().getColor(fallback);
        } catch (Exception e) {
            return 0xFFFFF3C7;
        }
    }

    private static int[] widgetSize(AppWidgetManager manager, int widgetId) {
        int width = 250;
        int height = 140;
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

    private static PendingIntent openAppIntent(Context context) {
        Intent open = new Intent(context, MainActivity.class);
        open.setAction(Intent.ACTION_VIEW);
        open.putExtra("ss_route", "journal");
        open.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP
                | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= 23) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }
        return PendingIntent.getActivity(context, OPEN_RC, open, flags);
    }
}
