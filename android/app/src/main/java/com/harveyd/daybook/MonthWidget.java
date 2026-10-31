package com.harveyd.daybook;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.res.ColorStateList;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.util.SizeF;
import android.view.View;
import android.widget.RemoteViews;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.Calendar;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/** Month grid with event titles; when wide (unfolded Fold) an agenda of the coming days sits beside it. */
public class MonthWidget extends AppWidgetProvider {
    static final String PREFS = "daybook_widget";
    static final String A_PREV = "com.harveyd.daybook.widget.PREV", A_NEXT = "com.harveyd.daybook.widget.NEXT",
            A_TODAY = "com.harveyd.daybook.widget.TODAY", A_REFRESH = "com.harveyd.daybook.widget.REFRESH";
    static final int BG = 0xFF0E0E10, FG = 0xFFF2F2F7, MUTED = 0xFF8E8E93, RED = 0xFFFF453A;
    static final String[] MONTHS = {"January","February","March","April","May","June","July","August","September","October","November","December"};
    static final String[] WD = {"S","M","T","W","T","F","S"};
    static final String[] WDL = {"Sun","Mon","Tue","Wed","Thu","Fri","Sat"};

    @Override public void onUpdate(Context c, AppWidgetManager m, int[] ids) { for (int id : ids) draw(c, m, id); scheduleMidnight(c); }
    @Override public void onAppWidgetOptionsChanged(Context c, AppWidgetManager m, int id, Bundle o) { draw(c, m, id); }

    @Override public void onReceive(Context c, Intent i) {
        String a = i.getAction();
        if (A_PREV.equals(a) || A_NEXT.equals(a) || A_TODAY.equals(a)) {
            SharedPreferences p = c.getSharedPreferences(PREFS, 0);
            int off = A_TODAY.equals(a) ? 0 : p.getInt("off", 0) + (A_NEXT.equals(a) ? 1 : -1);
            p.edit().putInt("off", off).apply();
            updateAll(c);
            return;
        }
        if (A_REFRESH.equals(a) || Intent.ACTION_DATE_CHANGED.equals(a) || "android.intent.action.TIME_SET".equals(a) || Intent.ACTION_TIMEZONE_CHANGED.equals(a)) {
            c.getSharedPreferences(PREFS, 0).edit().putInt("off", 0).apply();
            updateAll(c); scheduleMidnight(c); return;
        }
        super.onReceive(c, i);
    }

    static void updateAll(Context c) {
        AppWidgetManager m = AppWidgetManager.getInstance(c);
        for (int id : m.getAppWidgetIds(new ComponentName(c, MonthWidget.class))) draw(c, m, id);
    }

    static void scheduleMidnight(Context c) {
        try {
            AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
            Calendar t = Calendar.getInstance(); t.add(Calendar.DATE, 1);
            t.set(Calendar.HOUR_OF_DAY, 0); t.set(Calendar.MINUTE, 1); t.set(Calendar.SECOND, 0);
            am.set(AlarmManager.RTC, t.getTimeInMillis(), bc(c, A_REFRESH, 9));
        } catch (Exception ignored) {}
    }

    static PendingIntent bc(Context c, String action, int code) {
        Intent i = new Intent(c, MonthWidget.class).setAction(action);
        return PendingIntent.getBroadcast(c, code, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }
    static PendingIntent openDay(Context c, String day, int code) {
        Intent i = new Intent(c, MainActivity.class).setAction(Intent.ACTION_VIEW)
                .setData(Uri.parse("daybook://day/" + (day == null ? "" : day)))
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        return PendingIntent.getActivity(c, code, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    static void draw(Context c, AppWidgetManager m, int id) {
        Bundle o = m.getAppWidgetOptions(id);
        JSONObject snap = null;
        try { snap = new JSONObject(c.getSharedPreferences(PREFS, 0).getString("snap", "{}")); } catch (Exception e) { snap = new JSONObject(); }
        int off = c.getSharedPreferences(PREFS, 0).getInt("off", 0);
        RemoteViews rv;
        ArrayList<SizeF> sizes = Build.VERSION.SDK_INT >= 31 ? o.getParcelableArrayList(AppWidgetManager.OPTION_APPWIDGET_SIZES) : null;
        if (sizes != null && !sizes.isEmpty()) {
            Map<SizeF, RemoteViews> map = new HashMap<>();
            for (SizeF s : sizes) map.put(s, build(c, snap, off, s.getWidth(), s.getHeight()));
            rv = new RemoteViews(map);
        } else {
            int w = o.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 300), h = o.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT, 300);
            rv = build(c, snap, off, w, h);
        }
        m.updateAppWidget(id, rv);
    }

    static String ymd(Calendar d) { return String.format(Locale.US, "%04d-%02d-%02d", d.get(Calendar.YEAR), d.get(Calendar.MONTH) + 1, d.get(Calendar.DAY_OF_MONTH)); }
    static int mix(int a, int b, float t) { // t of a, rest b
        return Color.rgb((int) (Color.red(a) * t + Color.red(b) * (1 - t)), (int) (Color.green(a) * t + Color.green(b) * (1 - t)), (int) (Color.blue(a) * t + Color.blue(b) * (1 - t)));
    }
    static int parse(String s, int dflt) { try { return Color.parseColor(s); } catch (Exception e) { return dflt; } }
    static void tint(RemoteViews v, int id, int color) {
        if (Build.VERSION.SDK_INT >= 31) v.setColorStateList(id, "setBackgroundTintList", ColorStateList.valueOf(color));
        else v.setInt(id, "setBackgroundColor", color);
    }

    static RemoteViews build(Context c, JSONObject snap, int off, float wDp, float hDp) {
        String pkg = c.getPackageName();
        boolean wide = wDp >= 430;
        RemoteViews root = new RemoteViews(pkg, R.layout.widget_month);
        JSONObject days = snap.optJSONObject("days"); if (days == null) days = new JSONObject();
        int ws = snap.optInt("ws", 0);
        String todayS = ymd(Calendar.getInstance());

        Calendar first = Calendar.getInstance();
        first.set(Calendar.DAY_OF_MONTH, 1); first.add(Calendar.MONTH, off);
        int month = first.get(Calendar.MONTH), year = first.get(Calendar.YEAR);
        root.setTextViewText(R.id.w_month, MONTHS[month]);
        root.setTextViewText(R.id.w_year, String.valueOf(year));
        root.setViewVisibility(R.id.w_today, off == 0 ? View.GONE : View.VISIBLE);
        root.setOnClickPendingIntent(R.id.w_prev, bc(c, A_PREV, 1));
        root.setOnClickPendingIntent(R.id.w_next, bc(c, A_NEXT, 2));
        root.setOnClickPendingIntent(R.id.w_today, bc(c, A_TODAY, 3));
        root.setOnClickPendingIntent(R.id.w_title, openDay(c, todayS, 4));

        /* weekday labels */
        root.removeAllViews(R.id.w_wd);
        for (int i = 0; i < 7; i++) {
            RemoteViews t = new RemoteViews(pkg, R.layout.widget_wd);
            int wd = (ws + i) % 7;
            t.setTextViewText(R.id.wd, WD[wd]);
            t.setTextColor(R.id.wd, wd == 0 || wd == 6 ? 0xFF636366 : MUTED);
            root.addView(R.id.w_wd, t);
        }

        /* grid */
        Calendar d = (Calendar) first.clone();
        int lead = (d.get(Calendar.DAY_OF_WEEK) - 1 - ws + 7) % 7;
        d.add(Calendar.DATE, -lead);
        int dim = first.getActualMaximum(Calendar.DAY_OF_MONTH);
        int rows = (lead + dim + 6) / 7;
        float gridH = hDp - 30 - 18 - 12;              // header, weekday row, padding
        float cellH = gridH / rows;
        int chips = Math.max(0, Math.min(5, (int) ((cellH - 20) / 15)));
        root.removeAllViews(R.id.w_grid);
        int code = 100;
        for (int r = 0; r < rows; r++) {
            RemoteViews row = new RemoteViews(pkg, R.layout.widget_row);
            for (int i = 0; i < 7; i++, d.add(Calendar.DATE, 1)) {
                String ds = ymd(d);
                boolean inMonth = d.get(Calendar.MONTH) == month, isToday = ds.equals(todayS), past = ds.compareTo(todayS) < 0;
                RemoteViews cell = new RemoteViews(pkg, R.layout.widget_cell);
                cell.setTextViewText(R.id.c_num, String.valueOf(d.get(Calendar.DAY_OF_MONTH)));
                if (isToday) { cell.setInt(R.id.c_num, "setBackgroundResource", R.drawable.widget_today); cell.setTextColor(R.id.c_num, 0xFFFFFFFF); }
                else cell.setTextColor(R.id.c_num, !inMonth ? 0xFF48484A : past ? 0xFF8E8E93 : FG);
                JSONArray evs = days.optJSONArray(ds);
                int n = evs == null ? 0 : evs.length(), shown = 0;
                int[] ids = {R.id.c_e1, R.id.c_e2, R.id.c_e3, R.id.c_e4, R.id.c_e5};
                int room = n > chips ? chips - 1 : chips;
                for (int k = 0; k < n && shown < room && inMonth; k++, shown++) {
                    JSONObject e = evs.optJSONObject(k);
                    int col = parse(e.optString("c"), 0xFF0A84FF);
                    int id = ids[shown];
                    cell.setViewVisibility(id, View.VISIBLE);
                    cell.setTextViewText(id, (e.optBoolean("k") ? "○ " : "") + e.optString("t"));
                    float fade = past ? .55f : 1f;
                    cell.setTextColor(id, mix(mix(col, FG, .38f), BG, fade));
                    tint(cell, id, mix(col, BG, (e.optBoolean("a") ? .42f : .30f) * fade));
                }
                if (inMonth && n > shown && chips > 0) {
                    cell.setViewVisibility(R.id.c_more, View.VISIBLE);
                    cell.setTextViewText(R.id.c_more, "+" + (n - shown));
                } else if (inMonth && n > 0 && chips == 0) {
                    cell.setViewVisibility(R.id.c_more, View.VISIBLE);
                    cell.setTextViewText(R.id.c_more, "•");
                    cell.setTextColor(R.id.c_more, parse(evs.optJSONObject(0).optString("c"), MUTED));
                }
                cell.setOnClickPendingIntent(R.id.c_root, openDay(c, ds, code++));
                row.addView(R.id.r_root, cell);
            }
            root.addView(R.id.w_grid, row);
        }

        /* agenda beside the month when there is room */
        root.setViewVisibility(R.id.w_side, wide ? View.VISIBLE : View.GONE);
        if (wide) {
            root.removeAllViews(R.id.w_agenda);
            int budget = (int) ((hDp - 24) / 21);
            Calendar a = Calendar.getInstance();
            int used = 0, empty = 0;
            for (int dd = 0; dd < 21 && used < budget; dd++, a.add(Calendar.DATE, 1)) {
                String ds = ymd(a);
                JSONArray evs = days.optJSONArray(ds);
                if ((evs == null || evs.length() == 0) && dd > 1) continue;
                RemoteViews h = new RemoteViews(pkg, R.layout.widget_ag_day);
                String lbl = dd == 0 ? "Today" : dd == 1 ? "Tomorrow" : WDL[a.get(Calendar.DAY_OF_WEEK) - 1] + " " + a.get(Calendar.DAY_OF_MONTH) + " " + MONTHS[a.get(Calendar.MONTH)].substring(0, 3);
                h.setTextViewText(R.id.ag_d, lbl.toUpperCase(Locale.US));
                h.setTextColor(R.id.ag_d, dd == 0 ? RED : MUTED);
                h.setOnClickPendingIntent(R.id.ag_d, openDay(c, ds, code++));
                root.addView(R.id.w_agenda, h); used++;
                if (evs == null || evs.length() == 0) {
                    RemoteViews none = new RemoteViews(pkg, R.layout.widget_ag_none);
                    root.addView(R.id.w_agenda, none); used++; empty++;
                    continue;
                }
                for (int k = 0; k < evs.length() && used < budget; k++) {
                    JSONObject e = evs.optJSONObject(k);
                    RemoteViews it = new RemoteViews(pkg, R.layout.widget_ag_item);
                    int col = parse(e.optString("c"), 0xFF0A84FF);
                    it.setInt(R.id.ag_bar, "setBackgroundColor", col);
                    it.setTextViewText(R.id.ag_t, (e.optBoolean("k") ? "○ " : "") + e.optString("t"));
                    String tm = e.optBoolean("a") ? "all-day" : e.optString("s", "");
                    it.setTextViewText(R.id.ag_time, tm);
                    it.setOnClickPendingIntent(R.id.ag_root, openDay(c, ds, code++));
                    root.addView(R.id.w_agenda, it); used++;
                }
            }
        }
        return root;
    }
}
