package com.workbench.checkin;

import android.Manifest;
import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
import androidx.core.content.ContextCompat;
import androidx.work.ExistingPeriodicWorkPolicy;
import androidx.work.PeriodicWorkRequest;
import androidx.work.WorkManager;
import androidx.work.Worker;
import androidx.work.WorkerParameters;
import java.text.SimpleDateFormat;
import java.util.Calendar;
import java.util.Date;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;
import java.util.TimeZone;
import java.util.concurrent.TimeUnit;
import org.json.JSONArray;
import org.json.JSONObject;

public class TaskRolloverReceiver extends BroadcastReceiver {
    static void schedule(Context context) {
        WorkManager.getInstance(context).enqueueUniquePeriodicWork("task-rollover",
            ExistingPeriodicWorkPolicy.KEEP,
            new PeriodicWorkRequest.Builder(Maintenance.class,15,TimeUnit.MINUTES).build());
        scheduleMidnight(context);
    }

    private static void scheduleMidnight(Context context) {
        Calendar next = Calendar.getInstance();
        next.add(Calendar.DAY_OF_MONTH,1);
        next.set(Calendar.HOUR_OF_DAY,0);
        next.set(Calendar.MINUTE,0);
        next.set(Calendar.SECOND,0);
        next.set(Calendar.MILLISECOND,0);
        PendingIntent alarm = PendingIntent.getBroadcast(context,0,
            new Intent(context,TaskRolloverReceiver.class),
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        AlarmManager manager = (AlarmManager)context.getSystemService(Context.ALARM_SERVICE);
        if (Build.VERSION.SDK_INT < 31 || manager.canScheduleExactAlarms())
            manager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP,next.getTimeInMillis(),alarm);
        else manager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP,next.getTimeInMillis(),alarm);
    }

    @Override public void onReceive(Context context,Intent intent) {
        PendingResult pending = goAsync();
        new Thread(() -> {
            try { scheduleMidnight(context); maintain(context); }
            catch (Exception ignored) { /* Periodic maintenance retries the calendar operation. */ }
            finally { pending.finish(); }
        }).start();
    }

    static JSONArray plan(JSONObject values,long now) throws Exception {
        JSONArray tasks = new JSONArray(values.optString("wb.tasks.v1","[]"));
        JSONArray records = new JSONArray(values.optString("wb.records.v1","[]"));
        Set<String> completed = new HashSet<>();
        for (int i=0;i<records.length();i++) completed.add(records.getJSONObject(i).optString("taskId"));
        String today = new SimpleDateFormat("yyyy-MM-dd",Locale.ROOT).format(new Date(now));
        SimpleDateFormat time = new SimpleDateFormat("yyyy-MM-dd HH:mm",Locale.ROOT);
        time.setLenient(false);
        JSONArray events = new JSONArray();
        for (int i=0;i<tasks.length();i++) {
            JSONObject task = tasks.getJSONObject(i);
            String id = task.optString("id"), date = task.optString("scheduledDate"), clock = task.optString("scheduledTime");
            boolean allDay = task.optBoolean("calendarAllDay") && clock.isEmpty();
            if (!"none".equals(task.optString("recurrence","none")) || task.optBoolean("isQuick")
                || task.optLong("archivedAt",0)>0 || completed.contains(id)
                || !date.matches("\\d{4}-\\d{2}-\\d{2}") || date.compareTo(today)>=0
                || (!allDay && !clock.matches("([01]\\d|2[0-3]):[0-5]\\d"))) continue;
            JSONArray excluded = task.optJSONArray("excludedDates");
            boolean skip = false;
            if (excluded!=null) for(int j=0;j<excluded.length();j++) if(today.equals(excluded.optString(j))) skip=true;
            if(skip) continue;
            SimpleDateFormat parser = (SimpleDateFormat)time.clone();
            if(allDay) parser.setTimeZone(TimeZone.getTimeZone("UTC"));
            long start = parser.parse(today+" "+(allDay?"00:00":clock)).getTime();
            int duration = task.optInt("duration",0);
            if(duration<=0) duration=allDay?1440:30;
            events.put(new JSONObject().put("taskId",id+"@"+today).put("title",task.optString("title"))
                .put("start",start).put("end",start+duration*60000L).put("allDay",allDay)
                .put("reminderEnabled",task.optBoolean("reminderEnabled")).put("lead",task.optInt("reminderLead",0)));
        }
        return events;
    }

    static void maintain(Context context) throws Exception {
        if(ContextCompat.checkSelfPermission(context,Manifest.permission.READ_CALENDAR)!=PackageManager.PERMISSION_GRANTED
            || ContextCompat.checkSelfPermission(context,Manifest.permission.WRITE_CALENDAR)!=PackageManager.PERMISSION_GRANTED) return;
        synchronized(CalendarRepository.class) {
            JSONObject values=PrivateStoragePlugin.readValues(context);
            if(!"1".equals(values.optString("wb.calendar.enabled.v1"))) return;
            CalendarRepository repository=new CalendarRepository(context);
            Set<String> changed=new HashSet<>(),deleted=new HashSet<>();
            JSONArray changes=repository.collectChanges(),deletions=repository.collectDeletions();
            for(int i=0;i<changes.length();i++) changed.add(CalendarRepository.parentTaskId(changes.getJSONObject(i).getString("key")));
            for(int i=0;i<deletions.length();i++) deleted.add(CalendarRepository.parentTaskId(deletions.getString(i)));
            Set<String> tracked=new HashSet<>();
            for(String key:context.getSharedPreferences("calendar-events",0).getAll().keySet())
                tracked.add(CalendarRepository.parentTaskId(key));
            JSONArray events=plan(values,System.currentTimeMillis());
            for(int i=0;i<events.length();i++) {
                JSONObject event=events.getJSONObject(i);
                String key=event.getString("taskId"),id=CalendarRepository.parentTaskId(key);
                if(!tracked.contains(id)||changed.contains(id)||deleted.contains(id)) continue;
                repository.upsertEvent(key,event.getString("title"),event.getLong("start"),event.getLong("end"),
                    event.getInt("lead"),"来自打卡工作台",false,event.getBoolean("reminderEnabled"),event.getBoolean("allDay"),true);
            }
        }
    }

    public static class Maintenance extends Worker {
        public Maintenance(Context context,WorkerParameters params) { super(context,params); }
        @Override public Result doWork() {
            try { maintain(getApplicationContext()); scheduleMidnight(getApplicationContext()); return Result.success(); }
            catch(Exception ignored) { return Result.retry(); }
        }
    }
}
