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
import org.json.JSONObject;
import java.util.UUID;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.Map;
import java.util.HashMap;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import android.util.Base64;

/** Shared by foreground UI and background sync; all callers hold its class lock. */
public final class CalendarRepository {
    private final Context context;
    public CalendarRepository(Context context) { this.context=context.getApplicationContext(); }
    private String fingerprint(String value) throws Exception {return Base64.encodeToString(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8)),Base64.NO_WRAP);}
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
    public Set<Long> selectedCalendarIds() throws Exception {
        JSONArray values=new JSONArray(context.getSharedPreferences("calendar-sources",0).getString("ids","[]"));
        Set<Long> ids=new HashSet<>();for(int i=0;i<values.length();i++)ids.add(values.getLong(i));return ids;
    }
    public JSONArray availableCalendars() throws Exception {
        Set<Long> owned=ownedCalendarIds(),selected=selectedCalendarIds();JSONArray result=new JSONArray();
        Cursor cursor=context.getContentResolver().query(Calendars.CONTENT_URI,
            new String[]{Calendars._ID,Calendars.CALENDAR_DISPLAY_NAME,Calendars.ACCOUNT_NAME,Calendars.CALENDAR_ACCESS_LEVEL},
            Calendars.CALENDAR_ACCESS_LEVEL+">=?",new String[]{String.valueOf(Calendars.CAL_ACCESS_CONTRIBUTOR)},null);
        if(cursor==null)throw new Exception("无法读取可用日历");
        try{while(cursor.moveToNext()){
            long id=cursor.getLong(0);if(owned.contains(id))continue;
            result.put(new JSONObject().put("id",id).put("name",cursor.getString(1)).put("account",cursor.getString(2)).put("selected",selected.contains(id)));
        }}finally{cursor.close();}return result;
    }
    public void selectCalendars(JSONArray ids) throws Exception {
        Set<Long> available=new HashSet<>();JSONArray calendars=availableCalendars();for(int i=0;i<calendars.length();i++)available.add(calendars.getJSONObject(i).getLong("id"));
        for(int i=0;i<ids.length();i++)if(!available.contains(ids.getLong(i)))throw new Exception("所选日历不可写，请重新选择");
        if(!context.getSharedPreferences("calendar-sources",0).edit().putString("ids",ids.toString()).commit())throw new Exception("来源日历尚未保存，请重试");
    }
    private Set<Long> allowedCalendarIds() throws Exception {Set<Long> ids=ownedCalendarIds();ids.addAll(selectedCalendarIds());return ids;}
    public void blockTask(String id) {
        context.getSharedPreferences("calendar-removed-tasks",0).edit().putBoolean(id,true).apply();
    }
    public void allowTask(String key) {
        String id=parentTaskId(key);
        context.getSharedPreferences("calendar-removed-tasks",0).edit().remove(id).apply();
        context.getSharedPreferences("calendar-cloud-only",0).edit().remove(id).apply();
    }
    public void markCloudOnly(String id) {
        if(!context.getSharedPreferences("calendar-cloud-only",0).edit().putBoolean(id,true).commit())throw new IllegalStateException("日程接收状态尚未保存");
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
    /** Remove obsolete generated occurrences without recording a user deletion. */
    public int pruneOccurrences(Set<String> taskIds, Set<String> keepKeys, String fromDate) throws Exception {
        if(taskIds.isEmpty())return 0;
        Set<Long> owned=ownedCalendarIds();
        int removed=0;
        for(String key:context.getSharedPreferences("calendar-events",0).getAll().keySet()){
            String taskId=parentTaskId(key);
            if(taskId.equals(key)||taskId.startsWith("sys-")||!taskIds.contains(taskId)||keepKeys.contains(key)||key.substring(taskId.length()+1).compareTo(fromDate)<0
                ||context.getSharedPreferences("calendar-external",0).getBoolean(key,false))continue;
            long id=findEventId(key);
            if(id>0&&owned.contains(eventSnapshot(id).getLong("calendarId")))removed+=deleteEvent(key);
        }
        return removed;
    }

    public JSONArray collectDeletions() throws Exception {
        Set<String> keys=new HashSet<>(context.getSharedPreferences("calendar-events",0).getAll().keySet());
        if(ownedCalendarIds().isEmpty())for(String key:keys)if(!context.getSharedPreferences("calendar-external",0).getBoolean(key,false))throw new Exception("期待的专属日历不存在，无法确认日程删除；本机任务保持不变");
        for(String key:keys)if(findEventId(key)==0){
            long origin=context.getSharedPreferences("calendar-origins",0).getLong(key,0);
            if(origin>0){Cursor calendar=context.getContentResolver().query(Calendars.CONTENT_URI,new String[]{Calendars._ID},Calendars._ID+"=?",new String[]{String.valueOf(origin)},null);
                if(calendar==null)throw new Exception("无法确认来源日历，期待保持不变");try{if(!calendar.moveToFirst())throw new Exception("来源日历已移除，期待保持不变");}finally{calendar.close();}}
            context.getSharedPreferences("calendar-deletions",0).edit().putBoolean(key,true).apply();
        }
        JSONArray result=new JSONArray();
        for(String key:context.getSharedPreferences("calendar-deletions",0).getAll().keySet())result.put(key);
        return result;
    }
    private JSONObject eventSnapshot(long id) throws Exception {
        Cursor cursor=context.getContentResolver().query(Events.CONTENT_URI,
            new String[]{Events.TITLE,Events.DTSTART,Events.DTEND,Events.CALENDAR_ID,Events.ALL_DAY,Events.HAS_ALARM,Events.RRULE},Events._ID+"=?",new String[]{String.valueOf(id)},null);
        if(cursor==null)throw new Exception("无法读取日历修改，期待保持不变");
        try {
            if(!cursor.moveToFirst())throw new Exception("日程已发生变化，请重新同步");
            int lead=0;
            if(cursor.getInt(5)!=0){Cursor reminders=context.getContentResolver().query(Reminders.CONTENT_URI,new String[]{Reminders.MINUTES},Reminders.EVENT_ID+"=?",new String[]{String.valueOf(id)},Reminders.MINUTES+" ASC");
                if(reminders==null)throw new Exception("无法读取日历提醒");try{if(reminders.moveToFirst())lead=reminders.getInt(0);}finally{reminders.close();}}
            return new JSONObject().put("title",cursor.isNull(0)?"":cursor.getString(0)).put("startMillis",cursor.getLong(1)).put("endMillis",cursor.getLong(2))
                .put("calendarId",cursor.getLong(3)).put("allDay",cursor.getInt(4)!=0).put("reminderEnabled",cursor.getInt(5)!=0).put("reminderLeadMin",lead).put("rrule",cursor.isNull(6)?"":cursor.getString(6));
        }finally{cursor.close();}
    }
    public JSONArray collectChanges() throws Exception {
        JSONArray result=new JSONArray();
        for(String key:context.getSharedPreferences("calendar-events",0).getAll().keySet()) {
            long id=findEventId(key);if(id<=0)continue;
            JSONObject snapshot=eventSnapshot(id);
            String previous=context.getSharedPreferences("calendar-snapshots",0).getString(key,null);
            String hash=fingerprint(snapshot.toString());
            if(previous==null)context.getSharedPreferences("calendar-snapshots",0).edit().putString(key,hash).apply();
            else if(!previous.equals(hash))result.put(new JSONObject(snapshot.toString()).put("key",key).put("eventId",id));
        }
        return result;
    }
    public JSONArray collectNewEvents() throws Exception {return collectNewEvents(java.util.Collections.emptySet());}
    public JSONArray collectNewEvents(Set<String> activeIds) throws Exception {
        JSONArray result=new JSONArray();Set<Long> owned=ownedCalendarIds(),allowed=allowedCalendarIds();if(allowed.isEmpty())return result;
        Map<Long,String> known=new HashMap<>();for(Map.Entry<String,?> row:context.getSharedPreferences("calendar-events",0).getAll().entrySet())if(row.getValue() instanceof Long)known.put((Long)row.getValue(),row.getKey());
        String[] args=new String[allowed.size()];StringBuilder placeholders=new StringBuilder();int index=0;
        for(long id:allowed){if(index>0)placeholders.append(',');placeholders.append('?');args[index++]=String.valueOf(id);}
        Cursor cursor=context.getContentResolver().query(Events.CONTENT_URI,new String[]{Events._ID,Events.CALENDAR_ID,Events.DTSTART,Events.ALL_DAY},
            Events.CALENDAR_ID+" IN ("+placeholders+") AND "+Events.DELETED+"=0 AND ("+Events.RRULE+" IS NULL OR "+Events.RRULE+"='')",args,null);
        if(cursor==null)throw new Exception("无法读取新增日程");
        String instance=context.getSharedPreferences("calendar-sources",0).getString("instance",null);
        if(instance==null){instance=UUID.randomUUID().toString().substring(0,8);if(!context.getSharedPreferences("calendar-sources",0).edit().putString("instance",instance).commit())throw new Exception("尚未保存设备日历标识");}
        java.util.Calendar today=java.util.Calendar.getInstance();today.set(java.util.Calendar.HOUR_OF_DAY,0);today.set(java.util.Calendar.MINUTE,0);today.set(java.util.Calendar.SECOND,0);today.set(java.util.Calendar.MILLISECOND,0);
        String todayText=new SimpleDateFormat("yyyy-MM-dd",Locale.ROOT).format(today.getTime());
        try{while(cursor.moveToNext()){
            long id=cursor.getLong(0);String existingKey=known.get(id);
            if(!allowed.contains(cursor.getLong(1)))continue;
            if(existingKey!=null&&!context.getSharedPreferences("calendar-cloud-only",0).getBoolean(parentTaskId(existingKey),false))continue;
            if(cursor.getInt(3)==0&&cursor.getLong(2)<today.getTimeInMillis())continue;
            if(cursor.getInt(3)!=0){SimpleDateFormat utc=new SimpleDateFormat("yyyy-MM-dd",Locale.ROOT);utc.setTimeZone(TimeZone.getTimeZone("UTC"));if(utc.format(new Date(cursor.getLong(2))).compareTo(todayText)<0)continue;}
            JSONObject snapshot=eventSnapshot(id);if(snapshot.optString("title").trim().isEmpty()||!snapshot.optString("rrule").isEmpty()||snapshot.optLong("startMillis")<=0)continue;
            if(existingKey==null&&owned.contains(cursor.getLong(1))){
                Cursor origin=context.getContentResolver().query(Events.CONTENT_URI,new String[]{Events.CUSTOM_APP_PACKAGE,Events.CUSTOM_APP_URI,Events.DESCRIPTION},Events._ID+"=?",new String[]{String.valueOf(id)},null);
                if(origin==null)throw new Exception("无法确认新增日程来源");
                try{if(origin.moveToFirst()){
                    String app=origin.getString(0),uri=origin.getString(1),description=origin.getString(2);
                    if(context.getPackageName().equals(app)&&uri!=null){
                        Uri link=Uri.parse(uri);String restored=link.getLastPathSegment();
                        if("qidai".equals(link.getScheme())&&"task".equals(link.getAuthority())&&restored!=null&&restored.matches("[A-Za-z0-9_-]{1,100}@\\d{4}-\\d{2}-\\d{2}")
                            &&!context.getSharedPreferences("calendar-events",0).contains(restored)){
                            if(activeIds.contains(parentTaskId(restored))){markCloudOnly(parentTaskId(restored));bindExisting(restored,id);}continue;
                        }
                    }else if("来自打卡工作台".equals(description)||"已在打卡工作台完成".equals(description))continue;
                }}finally{origin.close();}
            }
            if(snapshot.optLong("endMillis")<=snapshot.getLong("startMillis"))snapshot.put("endMillis",snapshot.getLong("startMillis")+(snapshot.optBoolean("allDay")?86400000L:1800000L));
            SimpleDateFormat format=new SimpleDateFormat("yyyy-MM-dd",Locale.ROOT);if(snapshot.optBoolean("allDay"))format.setTimeZone(TimeZone.getTimeZone("UTC"));
            String key=existingKey!=null?existingKey:"sys-"+instance+"-"+id+"@"+format.format(new Date(snapshot.getLong("startMillis")));
            if(existingKey==null){markCloudOnly(parentTaskId(key));bindExisting(key,id);}
            result.put(snapshot.put("key",key).put("eventId",id).put("isNew",true));
            if(result.length()>2000)throw new Exception("单次新增日程过多，请缩小日历来源范围");
        }}finally{cursor.close();}return result;
    }
    public void bindExisting(String key,long id) throws Exception {
        JSONObject snapshot=eventSnapshot(id);
        if(!allowedCalendarIds().contains(snapshot.getLong("calendarId"))||!snapshot.optString("rrule").isEmpty())throw new Exception("日历来源已变化，尚未关联日程");
        long target=context.getSharedPreferences("calendar-events",0).getLong(key,-1);if(target>0&&target!=id)throw new Exception("日程关联已存在");
        if(!context.getSharedPreferences("calendar-external",0).edit().putBoolean(key,!ownedCalendarIds().contains(snapshot.getLong("calendarId"))).commit()
            ||!context.getSharedPreferences("calendar-origins",0).edit().putLong(key,snapshot.getLong("calendarId")).commit()
            ||!context.getSharedPreferences("calendar-snapshots",0).edit().putString(key,fingerprint(snapshot.toString())).commit()
            ||!context.getSharedPreferences("calendar-events",0).edit().putLong(key,id).commit())throw new Exception("日程关联尚未保存，请重试");
    }
    public void rebind(String from,String to,long id) throws Exception {
        if(findEventId(from)!=id)throw new Exception("日程映射已变化，尚未覆盖日历");
        long target=context.getSharedPreferences("calendar-events",0).getLong(to,-1);
        if(target>0&&target!=id)throw new Exception("日程目标已存在，尚未覆盖日历");
        context.getSharedPreferences("calendar-events",0).edit().remove(from).putLong(to,id).apply();
        context.getSharedPreferences("calendar-snapshots",0).edit().remove(from).putString(to,fingerprint(eventSnapshot(id).toString())).apply();
        context.getSharedPreferences("calendar-outgoing",0).edit().remove(from).remove(to).apply();
        boolean external=context.getSharedPreferences("calendar-external",0).getBoolean(from,false);
        context.getSharedPreferences("calendar-external",0).edit().remove(from).putBoolean(to,external).apply();
        context.getSharedPreferences("calendar-origins",0).edit().remove(from).putLong(to,eventSnapshot(id).getLong("calendarId")).apply();
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
                new String[]{ Events._ID, Events.CALENDAR_ID, Events.DELETED, Events.RRULE },
                Events._ID + "=?",
                new String[]{ String.valueOf(knownId) },
                null);
        if (c != null) {
            try {
                if (c.moveToFirst()) {
                    long calendarId=c.getLong(c.getColumnIndexOrThrow(Events.CALENDAR_ID));
                    if(!allowedCalendarIds().contains(calendarId))return -2;
                    String repeat=c.getString(c.getColumnIndexOrThrow(Events.RRULE));
                    if(!ownedCalendarIds().contains(calendarId)&&repeat!=null&&!repeat.isEmpty())return -2;
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
        return upsertEvent(taskId,title,startMillis,endMillis,reminderLeadMin,description,completed,reminderEnabled,false);
    }
    public long upsertEvent(String taskId, String title, long startMillis, long endMillis,
                             int reminderLeadMin, String description, boolean completed, boolean reminderEnabled,boolean allDay) throws Exception {
        return upsertEvent(taskId,title,startMillis,endMillis,reminderLeadMin,description,completed,reminderEnabled,allDay,false);
    }
    public long upsertEvent(String taskId, String title, long startMillis, long endMillis,
                             int reminderLeadMin, String description, boolean completed, boolean reminderEnabled,boolean allDay,boolean singleOccurrence) throws Exception {
        ContentResolver cr = context.getContentResolver();
        if(context.getSharedPreferences("calendar-removed-tasks",0).getBoolean(parentTaskId(taskId),false)
            ||context.getSharedPreferences("calendar-deletions",0).getBoolean(taskId,false))return 0;
        long existing = findEventId(taskId);
        if(existing==-1&&singleOccurrence){
            java.util.List<String> previousKeys=new java.util.ArrayList<>();
            for(String key:context.getSharedPreferences("calendar-events",0).getAll().keySet())if(parentTaskId(key).equals(parentTaskId(taskId)))previousKeys.add(key);
            if(previousKeys.size()==1){long previousId=findEventId(previousKeys.get(0));if(previousId>0){rebind(previousKeys.get(0),taskId,previousId);existing=previousId;}}
        }
        if(existing==-2)return 0;
        if(existing==0){
            if(ownedCalendarIds().isEmpty())throw new Exception("期待的专属日历不存在，尚未重建日程");
            context.getSharedPreferences("calendar-deletions",0).edit().putBoolean(taskId,true).apply();
            return 0;
        }
        JSONObject previous=existing>0?eventSnapshot(existing):null;
        long calId=previous!=null?previous.getLong("calendarId"):getWritableCalendarId();
        boolean external=!ownedCalendarIds().contains(calId);
        boolean preserveOriginal=external||(existing>0&&parentTaskId(taskId).startsWith("sys-"));

        String outgoing=fingerprint(new JSONObject().put("title",title).put("start",startMillis).put("end",endMillis)
            .put("lead",reminderLeadMin).put("completed",completed).put("reminder",reminderEnabled).put("allDay",allDay).toString());
        if(existing>0&&outgoing.equals(context.getSharedPreferences("calendar-outgoing",0).getString(taskId,null))
            &&fingerprint(eventSnapshot(existing).toString()).equals(context.getSharedPreferences("calendar-snapshots",0).getString(taskId,null)))return existing;

        ContentValues ev = new ContentValues();
        ev.put(Events.CALENDAR_ID, calId);
        ev.put(Events.TITLE, completed ? "✅ 已完成｜" + title : title);
        ev.put(Events.DTSTART, startMillis);
        ev.put(Events.DTEND, endMillis);
        ev.put(Events.EVENT_TIMEZONE, allDay?"UTC":TimeZone.getDefault().getID());
        ev.put(Events.ALL_DAY,allDay?1:0);
        ev.put(Events.HAS_ALARM, !completed && reminderEnabled ? 1 : 0);
        if(!preserveOriginal){
            ev.put(Events.DESCRIPTION, description != null ? description : "");ev.put(Events.EVENT_COLOR, 0x4F6EF7);
            ev.put(Events.CUSTOM_APP_PACKAGE,context.getPackageName());ev.put(Events.CUSTOM_APP_URI,new Uri.Builder().scheme("qidai").authority("task").appendPath(taskId).build().toString());
        }
        boolean adjustReminders=!preserveOriginal||previous==null||previous.optBoolean("reminderEnabled")!=(!completed&&reminderEnabled)||previous.optInt("reminderLeadMin")!=reminderLeadMin;

        long eventId;
        if (existing > 0) {
            cr.update(Events.CONTENT_URI, ev, Events._ID + "=?", new String[]{ String.valueOf(existing) });
            eventId = existing;
            // 清除旧提醒后重设
            if(adjustReminders)cr.delete(Reminders.CONTENT_URI, Reminders.EVENT_ID + "=?", new String[]{ String.valueOf(eventId) });
        } else {
            Uri uri = cr.insert(Events.CONTENT_URI, ev);
            if (uri == null) throw new Exception("插入日历事件失败");
            eventId = Long.parseLong(uri.getLastPathSegment());
        }
        context.getSharedPreferences("calendar-events", 0).edit().putLong(taskId, eventId).apply();
        context.getSharedPreferences("calendar-external",0).edit().putBoolean(taskId,external).apply();
        context.getSharedPreferences("calendar-origins",0).edit().putLong(taskId,calId).apply();

        if (adjustReminders && !completed && reminderEnabled) {
            ContentValues rem = new ContentValues();
            rem.put(Reminders.EVENT_ID, eventId);
            rem.put(Reminders.MINUTES, reminderLeadMin);
            rem.put(Reminders.METHOD, Reminders.METHOD_ALERT);
            cr.insert(Reminders.CONTENT_URI, rem);
        }
        context.getSharedPreferences("calendar-snapshots",0).edit().putString(taskId,fingerprint(eventSnapshot(eventId).toString())).apply();
        context.getSharedPreferences("calendar-outgoing",0).edit().putString(taskId,outgoing).apply();
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
            if(n==0&&findEventId(taskId)>0)throw new Exception("日历未允许删除，保留关联以便重试");
        }
        context.getSharedPreferences("calendar-events", 0).edit().remove(taskId).apply();
        context.getSharedPreferences("calendar-deletions",0).edit().remove(taskId).apply();
        context.getSharedPreferences("calendar-snapshots",0).edit().remove(taskId).apply();
        context.getSharedPreferences("calendar-outgoing",0).edit().remove(taskId).apply();
        context.getSharedPreferences("calendar-external",0).edit().remove(taskId).apply();
        context.getSharedPreferences("calendar-origins",0).edit().remove(taskId).apply();
        return n;
    }
}

