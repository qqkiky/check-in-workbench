package com.workbench.checkin;

import android.Manifest;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.database.Cursor;
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
        @Permission(strings = { Manifest.permission.READ_CALENDAR }, alias = "calendar"),
        @Permission(strings = { Manifest.permission.WRITE_CALENDAR }, alias = "calendar")
    }
)
public class TaskCalendarPlugin extends Plugin {

    private static final String TAG = "TaskCalendarPlugin";
    private static final String SYNC_TAG = "checkin:";
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

        runIO(() -> {
            try {
                long eventId = upsertEvent(taskId, title, startMillis, endMillis, reminderLeadMin, description);
                JSObject res = new JSObject();
                res.put("ok", true);
                res.put("eventId", eventId);
                call.resolve(res);
            } catch (Exception e) {
                Log.e(TAG, "syncTask failed", e);
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
                    com.getcapacitor.JSObject t = tasks.getJSONObject(i);
                    String taskId = t.getString("taskId");
                    if (TextUtils.isEmpty(taskId)) continue;
                    String title = t.optString("title", "待办");
                    long start = (long) t.optDouble("startMillis", 0);
                    if (start <= 0) continue;
                    long end = (long) t.optDouble("endMillis", 0);
                    if (end <= start) end = start + DEFAULT_EVENT_DURATION_MS;
                    int lead = t.optInt("reminderLeadMin", 0);
                    String desc = t.optString("description", "");
                    long eventId = upsertEvent(taskId, title, start, end, lead, desc);
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
                Log.e(TAG, "syncAll failed", e);
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
                int removed = deleteEvent(taskId);
                JSObject res = new JSObject();
                res.put("ok", true);
                res.put("removed", removed);
                call.resolve(res);
            } catch (Exception e) {
                Log.e(TAG, "removeTask failed", e);
                call.reject("删除日历事件失败：" + e.getMessage());
            }
        });
    }

    // -------------------------------------------------------------------------
    // 内部实现
    // -------------------------------------------------------------------------

    /** 后台线程执行 IO（Capacitor 的 call.resolve/reject 线程安全） */
    private void runIO(Runnable block) {
        new Thread(block).start();
    }

    /** 查找或创建可写日历，返回其 _ID */
    private long getWritableCalendarId() throws Exception {
        ContentResolver cr = getContext().getContentResolver();
        final String[] proj = { Calendars._ID, Calendars.ACCOUNT_NAME, Calendars.ACCOUNT_TYPE };
        String sel = "(" + Calendars.CAN_MODIFY + "=1 OR " + Calendars.CALENDAR_ACCESS_LEVEL + ">="
                + Calendars.CAL_ACCESS_CONTRIBUTOR + ") AND " + Calendars.SYNC_EVENTS + "=1";
        Cursor c = cr.query(Calendars.CONTENT_URI, proj, sel, null, Calendars._ID + " ASC");
        if (c != null) {
            try {
                if (c.moveToFirst()) {
                    return c.getLong(c.getColumnIndexOrThrow(Calendars._ID));
                }
            } finally {
                c.close();
            }
        }
        return createLocalCalendar();
    }

    /** 创建一个本地日历（无需真实账号，MIUI/安卓均支持 LOCAL 类型） */
    private long createLocalCalendar() throws Exception {
        ContentResolver cr = getContext().getContentResolver();
        ContentValues cv = new ContentValues();
        cv.put(Calendars.ACCOUNT_NAME, "打卡工作台");
        cv.put(Calendars.ACCOUNT_TYPE, CalendarContract.ACCOUNT_TYPE_LOCAL);
        cv.put(Calendars.NAME, "checkin");
        cv.put(Calendars.CALENDAR_DISPLAY_NAME, "打卡工作台");
        cv.put(Calendars.CALENDAR_COLOR, 0x4F6EF7);
        cv.put(Calendars.CALENDAR_ACCESS_LEVEL, Calendars.CAL_ACCESS_OWNER);
        cv.put(Calendars.OWNER_ACCOUNT, "checkin@local");
        cv.put(Calendars.SYNC_EVENTS, 1);
        cv.put(Calendars.VISIBLE, 1);
        Uri calUri = Calendars.CONTENT_URI.buildUpon()
                .appendQueryParameter(CalendarContract.CALLER_IS_SYNCADAPTER, "true")
                .build();
        Uri result = cr.insert(calUri, cv);
        if (result == null) throw new Exception("无法创建本地日历");
        return Long.parseLong(result.getLastPathSegment());
    }

    /** 按 taskId 查询已有事件 _ID（无则 -1） */
    private long findEventId(String taskId) {
        ContentResolver cr = getContext().getContentResolver();
        Cursor c = cr.query(
                Events.CONTENT_URI,
                new String[]{ Events._ID },
                Events.SYNC_DATA1 + "=?",
                new String[]{ SYNC_TAG + taskId },
                null);
        if (c != null) {
            try {
                if (c.moveToFirst()) {
                    return c.getLong(c.getColumnIndexOrThrow(Events._ID));
                }
            } finally {
                c.close();
            }
        }
        return -1;
    }

    /** 插入或更新一条事件 + 提醒，返回事件 _ID */
    private long upsertEvent(String taskId, String title, long startMillis, long endMillis,
                             int reminderLeadMin, String description) throws Exception {
        ContentResolver cr = getContext().getContentResolver();
        long calId = getWritableCalendarId();
        long existing = findEventId(taskId);

        ContentValues ev = new ContentValues();
        ev.put(Events.CALENDAR_ID, calId);
        ev.put(Events.TITLE, title);
        ev.put(Events.DTSTART, startMillis);
        ev.put(Events.DTEND, endMillis);
        ev.put(Events.EVENT_TIMEZONE, TimeZone.getDefault().getID());
        ev.put(Events.HAS_ALARM, 1);
        ev.put(Events.DESCRIPTION, description != null ? description : "");
        ev.put(Events.SYNC_DATA1, SYNC_TAG + taskId);
        ev.put(Events.EVENT_COLOR, 0x4F6EF7);

        long eventId;
        if (existing > 0) {
            cr.update(Events.CONTENT_URI, ev, Events._ID + "=?", new String[]{ String.valueOf(existing) });
            eventId = existing;
            // 清除旧提醒后重设
            cr.delete(Reminders.CONTENT_URI, Reminders.EVENT_ID + "=?", new String[]{ String.valueOf(eventId) });
        } else {
            Uri uri = cr.insert(Events.CONTENT_URI, ev);
            if (uri == null) throw new Exception("插入日历事件失败");
            eventId = Long.parseLong(uri.getLastPathSegment());
        }

        ContentValues rem = new ContentValues();
        rem.put(Reminders.EVENT_ID, eventId);
        rem.put(Reminders.MINUTES, reminderLeadMin);
        rem.put(Reminders.METHOD, Reminders.METHOD_ALERT);
        cr.insert(Reminders.CONTENT_URI, rem);
        return eventId;
    }

    /** 删除指定 taskId 的日历事件 */
    private int deleteEvent(String taskId) throws Exception {
        ContentResolver cr = getContext().getContentResolver();
        long eventId = findEventId(taskId);
        if (eventId <= 0) return 0;
        int n = cr.delete(Events.CONTENT_URI, Events._ID + "=?", new String[]{ String.valueOf(eventId) });
        return n;
    }
}
