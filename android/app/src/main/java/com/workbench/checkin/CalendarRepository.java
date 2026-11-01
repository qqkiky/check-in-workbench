package com.workbench.checkin;
import android.content.Context;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.database.Cursor;
import android.net.Uri;
import android.provider.CalendarContract;
import android.provider.CalendarContract.Calendars;
import android.provider.CalendarContract.Events;
import android.provider.CalendarContract.Reminders;
import java.util.TimeZone;
import java.util.Set;
import java.util.HashSet;
import org.json.JSONArray;

/** Shared by foreground UI and background sync; all callers hold its class lock. */
public final class CalendarRepository {
    private final Context context;
    public CalendarRepository(Context context) { this.context=context.getApplicationContext(); }
    /** 查找或创建可写日历，返回其 _ID */
    private long getWritableCalendarId() throws Exception {
        ContentResolver cr = context.getContentResolver();
        final String[] proj = { Calendars._ID, Calendars.ACCOUNT_NAME, Calendars.ACCOUNT_TYPE };
        // Never select or modify an unrelated personal/work calendar.
        String sel = Calendars.ACCOUNT_NAME + "=? AND " + Calendars.ACCOUNT_TYPE + "=? AND " + Calendars.NAME + "=?";
        Cursor c = cr.query(Calendars.CONTENT_URI, proj, sel,
                new String[]{"打卡工作台", CalendarContract.ACCOUNT_TYPE_LOCAL, "checkin"}, Calendars._ID + " ASC");
        if(c==null)throw new Exception("无法读取期待日历，尚未创建或清理日程");
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

    public static String parentTaskId(String key) {
        return key.matches(".+@\\d{4}-\\d{2}-\\d{2}")?key.substring(0,key.length()-11):key;
    }
    private Set<Long> ownedCalendarIds() throws Exception {
        Set<Long> ids=new HashSet<>();
        Cursor cursor=context.getContentResolver().query(Calendars.CONTENT_URI,new String[]{Calendars._ID},
            Calendars.ACCOUNT_NAME+"=? AND "+Calendars.ACCOUNT_TYPE+"=? AND "+Calendars.NAME+"=?",
            new String[]{"打卡工作台",CalendarContract.ACCOUNT_TYPE_LOCAL,"checkin"},null);
        if(cursor==null)throw new Exception("无法读取期待日历，尚未处理删除");
        try{while(cursor.moveToNext())ids.add(cursor.getLong(0));}finally{cursor.close();}
        return ids;
    }
    public void blockTask(String id) {
        context.getSharedPreferences("calendar-removed-tasks",0).edit().putBoolean(id,true).apply();
    }
    public void allowTask(String key) {
        String id=parentTaskId(key);
        context.getSharedPreferences("calendar-removed-tasks",0).edit().remove(id).apply();
        context.getSharedPreferences("calendar-cloud-only",0).edit().remove(id).apply();
    }
    public void markCloudOnly(String id) {
        context.getSharedPreferences("calendar-cloud-only",0).edit().putBoolean(id,true).apply();
    }
    /** Full snapshots may remove orphans. Partial updates must never prune other tasks. */
    public int pruneTasks(Set<String> activeIds) throws Exception {
        for(String id:activeIds)context.getSharedPreferences("calendar-cloud-only",0).edit().remove(id).apply();
        int removed=0;
        Set<String> keys=new HashSet<>(context.getSharedPreferences("calendar-events",0).getAll().keySet());
        keys.addAll(context.getSharedPreferences("calendar-deletions",0).getAll().keySet());
        for(String key:keys) {
            String id=parentTaskId(key);
            if(!activeIds.contains(id)&&!context.getSharedPreferences("calendar-cloud-only",0).getBoolean(id,false))removed+=deleteEvent(key);
        }
        return removed;
    }
    public JSONArray collectDeletions() throws Exception {
        Set<String> keys=new HashSet<>(context.getSharedPreferences("calendar-events",0).getAll().keySet());
        if(!keys.isEmpty()&&ownedCalendarIds().isEmpty())throw new Exception("期待的专属日历不存在，无法确认日程删除；本机任务保持不变");
        for(String key:keys)if(findEventId(key)==0)context.getSharedPreferences("calendar-deletions",0).edit().putBoolean(key,true).apply();
        JSONArray result=new JSONArray();
        for(String key:context.getSharedPreferences("calendar-deletions",0).getAll().keySet())result.put(key);
        return result;
    }

    /** 创建一个本地日历（无需真实账号，MIUI/安卓均支持 LOCAL 类型） */
    private long createLocalCalendar() throws Exception {
        ContentResolver cr = context.getContentResolver();
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
                .appendQueryParameter(Calendars.ACCOUNT_NAME, "打卡工作台")
                .appendQueryParameter(Calendars.ACCOUNT_TYPE, CalendarContract.ACCOUNT_TYPE_LOCAL)
                .build();
        Uri result = cr.insert(calUri, cv);
        if (result == null) throw new Exception("无法创建本地日历");
        return Long.parseLong(result.getLastPathSegment());
    }

    /** 按 taskId 查询已有事件 _ID（无则 -1） */
    private long findEventId(String taskId) throws Exception {
        ContentResolver cr = context.getContentResolver();
        long knownId = context.getSharedPreferences("calendar-events", 0).getLong(taskId, -1);
        if (knownId <= 0) return -1;
        Cursor c = cr.query(
                Events.CONTENT_URI,
                new String[]{ Events._ID, Events.CALENDAR_ID, Events.DELETED },
                Events._ID + "=?",
                new String[]{ String.valueOf(knownId) },
                null);
        if (c != null) {
            try {
                if (c.moveToFirst()) {
                    if(!ownedCalendarIds().contains(c.getLong(c.getColumnIndexOrThrow(Events.CALENDAR_ID))))return -2;
                    if(c.getInt(c.getColumnIndexOrThrow(Events.DELETED))!=0)return 0;
                    return c.getLong(c.getColumnIndexOrThrow(Events._ID));
                }
            } finally {
                c.close();
            }
        } else throw new Exception("无法核实已同步日程，尚未处理删除");
        return 0;
    }

    /** 插入或更新一条事件 + 提醒，返回事件 _ID */
    public long upsertEvent(String taskId, String title, long startMillis, long endMillis,
                             int reminderLeadMin, String description, boolean completed, boolean reminderEnabled) throws Exception {
        ContentResolver cr = context.getContentResolver();
        if(context.getSharedPreferences("calendar-removed-tasks",0).getBoolean(parentTaskId(taskId),false)
            ||context.getSharedPreferences("calendar-deletions",0).getBoolean(taskId,false))return 0;
        long existing = findEventId(taskId);
        if(existing==0){
            if(ownedCalendarIds().isEmpty())throw new Exception("期待的专属日历不存在，尚未重建日程");
            context.getSharedPreferences("calendar-deletions",0).edit().putBoolean(taskId,true).apply();
            return 0;
        }
        long calId = getWritableCalendarId();

        ContentValues ev = new ContentValues();
        ev.put(Events.CALENDAR_ID, calId);
        ev.put(Events.TITLE, completed ? "✅ 已完成｜" + title : title);
        ev.put(Events.DTSTART, startMillis);
        ev.put(Events.DTEND, endMillis);
        ev.put(Events.EVENT_TIMEZONE, TimeZone.getDefault().getID());
        ev.put(Events.HAS_ALARM, !completed && reminderEnabled ? 1 : 0);
        ev.put(Events.DESCRIPTION, description != null ? description : "");
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
        context.getSharedPreferences("calendar-events", 0).edit().putLong(taskId, eventId).apply();

        if (!completed && reminderEnabled) {
            ContentValues rem = new ContentValues();
            rem.put(Reminders.EVENT_ID, eventId);
            rem.put(Reminders.MINUTES, reminderLeadMin);
            rem.put(Reminders.METHOD, Reminders.METHOD_ALERT);
            cr.insert(Reminders.CONTENT_URI, rem);
        }
        return eventId;
    }

    /** 删除指定 taskId 的日历事件 */
    public int deleteEvent(String taskId) throws Exception {
        ContentResolver cr = context.getContentResolver();
        long eventId = findEventId(taskId);
        int n=0;
        if(eventId>0){
            cr.delete(Reminders.CONTENT_URI,Reminders.EVENT_ID+"=?",new String[]{String.valueOf(eventId)});
            n=cr.delete(Events.CONTENT_URI,Events._ID+"=?",new String[]{String.valueOf(eventId)});
        }
        context.getSharedPreferences("calendar-events", 0).edit().remove(taskId).apply();
        context.getSharedPreferences("calendar-deletions",0).edit().remove(taskId).apply();
        return n;
    }
}

