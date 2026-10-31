package com.harveyd.daybook;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** Receives the calendar snapshot from the web app and redraws the home-screen widget. */
@CapacitorPlugin(name = "DaybookWidget")
public class WidgetBridgePlugin extends Plugin {
    @PluginMethod
    public void save(PluginCall call) {
        String json = call.getString("json");
        if (json == null) { call.reject("json missing"); return; }
        getContext().getSharedPreferences(MonthWidget.PREFS, 0).edit().putString("snap", json).apply();
        MonthWidget.updateAll(getContext());
        call.resolve();
    }
}
