package com.workbench.checkin;

import android.Manifest;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.database.Cursor;
import android.net.Uri;
import android.provider.CalendarContract;
import android.provider.CalendarContract.Calendars;
import android.provider.CalendarContract.Events;
import android.provider.CalendarContract.Reminders;
import android.text.TextUtils;
import android.util.Log;

import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.JSObject;

import java.util.TimeZone;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import org.json.JSONObject;

/**
 * TaskCalendar —— 把工作台待办写入系统日历并设置提醒。
 *
 * 设计要点：
 * - 通过 CalendarContract 写入/更新/删除系统日历事件；提醒由系统日历进程负责，
 *   主应用被杀后到点仍会弹提醒（MIUI 日历原生支持）。
 * - 用 Events.SYNC_DATA1 存入 "checkin:<taskId>" 作为幂等标识，便于更新/删除时定位。
 * - 优先复用设备上「可写」日历；若无则创建一个本地日历（ACCOUNT_TYPE_LOCAL）。
 * - IO 操作在后台线程执行，避免阻塞 UI / 触发严格模式。
 */
@CapacitorPlugin(
    name = "TaskCalendar",
    permissions = {
        @Permission(strings = { Manifest.permission.READ_CALENDAR, Manifest.permission.WRITE_CALENDAR }, alias = "calendar")
    }
)
public class TaskCalendarPlugin extends Plugin {

    private static final String TAG = "TaskCalendarPlugin";
    private static final String SYNC_TAG = "checkin:";
    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private static final int DEFAULT_EVENT_DURATION_MS = 30 * 60 * 1000; // 无时长时默认 30 分钟

    // -------------------------------------------------------------------------
    // 公开方法
    // -------------------------------------------------------------------------

    /** 写入/更新单条待办的日历事件与提醒 */
    @PluginMethod
    public void syncTask(PluginCall call) {
        if (!PermissionState.GRANTED.equals(getPermissionState("calendar"))) {
            call.reject("日历权限未授予，请先调用 requestPermissions()");
            return;
        }
        final String taskId = call.getString("taskId");
        if (TextUtils.isEmpty(taskId)) {
            call.reject("taskId 不能为空");
            return;
        }
        final String title = call.getString("title", "待办");
        final Long startMillis = call.getDouble("startMillis") != null
                ? call.getDouble("startMillis").longValue() : null;
        if (startMillis == null) {
            call.reject("startMillis 不能为空");
            return;
        }
        final Double endDouble = call.getDouble("endMillis");
        final long endMillis = endDouble != null && endDouble > startMillis
                ? endDouble.longValue() : startMillis + DEFAULT_EVENT_DURATION_MS;
        final Integer leadObj = call.getInt("reminderLeadMin");
        final int reminderLeadMin = (leadObj != null && leadObj >= 0) ? leadObj : 0;
        final String description = call.getString("description", "");
        final boolean completed = Boolean.TRUE.equals(call.getBoolean("completed", false));
        final boolean reminderEnabled = Boolean.TRUE.equals(call.getBoolean("reminderEnabled", true));

        runIO(() -> {
            try {
                long eventId = upsertEvent(taskId, title, startMillis, endMillis, reminderLeadMin, description, completed, reminderEnabled);
                JSObject res = new JSObject();
                res.put("ok", true);
                res.put("eventId", eventId);
                call.resolve(res);
            } catch (Exception e) {
                Log.e(TAG, "syncTask failed");
                call.reject("写入日历失败：" + e.getMessage());
            }
        });
    }

    /** 批量同步某一天的待办（简单循环，每条独立 upsert） */
    @PluginMethod
    public void syncAll(PluginCall call) {
        if (!PermissionState.GRANTED.equals(getPermissionState("calendar"))) {
            call.reject("日历权限未授予，请先调用 requestPermissions()");
            return;
        }
        com.getcapacitor.JSArray tasks = call.getArray("tasks");
        if (tasks == null) {
            call.reject("tasks 不能为空");
            return;
        }
        runIO(() -> {
            try {
                int synced = 0;
                com.getcapacitor.JSArray results = new com.getcapacitor.JSArray();
                for (int i = 0; i < tasks.length(); i++) {
                    JSONObject t = tasks.getJSONObject(i);
                    String taskId = t.getString("taskId");
                    if (TextUtils.isEmpty(taskId)) continue;
                    String title = t.optString("title", "待办");
                    long start = (long) t.optDouble("startMillis", 0);
                    if (start <= 0) continue;
                    long end = (long) t.optDouble("endMillis", 0);
                    if (end <= start) end = start + DEFAULT_EVENT_DURATION_MS;
                    int lead = t.optInt("reminderLeadMin", 0);
                    String desc = t.optString("description", "");
                    long eventId = upsertEvent(taskId, title, start, end, lead, desc, t.optBoolean("completed", false), t.optBoolean("reminderEnabled", true));
                    com.getcapacitor.JSObject r = new com.getcapacitor.JSObject();
                    r.put("taskId", taskId);
                    r.put("eventId", eventId);
                    results.put(r);
                    synced++;
                }
                JSObject res = new JSObject();
                res.put("ok", true);
                res.put("synced", synced);
                res.put("results", results);
                call.resolve(res);
            } catch (Exception e) {
                Log.e(TAG, "syncAll failed");
                call.reject("批量写入日历失败：" + e.getMessage());
            }
        });
    }

    /** 删除指定待办对应的日历事件 */
    @PluginMethod
    public void removeTask(PluginCall call) {
        if (!PermissionState.GRANTED.equals(getPermissionState("calendar"))) {
            call.reject("日历权限未授予，请先调用 requestPermissions()");
            return;
        }
        final String taskId = call.getString("taskId");
        if (TextUtils.isEmpty(taskId)) {
            call.reject("taskId 不能为空");
            return;
        }
        runIO(() -> {
            try {
                int removed = 0;
                for (String key : getContext().getSharedPreferences("calendar-events", 0).getAll().keySet()) {
                    if (key.equals(taskId) || key.startsWith(taskId + "@")) removed += deleteEvent(key);
                }
                JSObject res = new JSObject();
                res.put("ok", true);
                res.put("removed", removed);
                call.resolve(res);
            } catch (Exception e) {
                Log.e(TAG, "removeTask failed");
                call.reject("删除日历事件失败：" + e.getMessage());
            }
        });
    }

    // -------------------------------------------------------------------------
    // 内部实现
    // -------------------------------------------------------------------------

    /** 后台线程执行 IO（Capacitor 的 call.resolve/reject 线程安全） */
    private void runIO(Runnable block) {
        executor.execute(block);
    }

    private long upsertEvent(String taskId, String title, long startMillis, long endMillis,
            int lead, String description, boolean completed, boolean reminderEnabled) throws Exception {
        synchronized (CalendarRepository.class) {
            return new CalendarRepository(getContext()).upsertEvent(taskId, title, startMillis, endMillis, lead, description, completed, reminderEnabled);
        }
    }
    private int deleteEvent(String taskId) throws Exception {
        synchronized (CalendarRepository.class) {
            return new CalendarRepository(getContext()).deleteEvent(taskId);
        }
    }
}
