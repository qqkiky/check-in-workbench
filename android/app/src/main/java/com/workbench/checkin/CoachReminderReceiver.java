package com.workbench.checkin;

import android.Manifest;
import android.annotation.SuppressLint;
import java.security.MessageDigest;
import java.nio.charset.StandardCharsets;
import java.util.Calendar;
import android.app.AlarmManager;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.os.Build;
import android.provider.Settings;
import android.net.Uri;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;
import org.json.JSONArray;
import org.json.JSONObject;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

/** Local alarms contain only occurrence keys; current encrypted phone data wins at delivery. */
public class CoachReminderReceiver extends BroadcastReceiver {
    static final String PREFS="coach-alarms",CHANNEL="coach-actions";
    static SharedPreferences prefs(Context c){return c.getSharedPreferences(PREFS,Context.MODE_PRIVATE);}
    static PendingIntent alarm(Context c,String key){
        return PendingIntent.getBroadcast(c,0,new Intent(c,CoachReminderReceiver.class).setData(Uri.parse("checkin-coach://alarm/"+Uri.encode(key))).putExtra("key",key),PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
    }
    static void cancel(Context c,String key){
        ((AlarmManager)c.getSystemService(Context.ALARM_SERVICE)).cancel(alarm(c,key));
        NotificationManagerCompat.from(c).cancel(key,1);
    }
    static void schedule(Context c,String key,long at){
        AlarmManager manager=(AlarmManager)c.getSystemService(Context.ALARM_SERVICE);
        if(Build.VERSION.SDK_INT<31||manager.canScheduleExactAlarms())manager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP,at,alarm(c,key));
        else manager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP,at,alarm(c,key));
    }
    static boolean permitted(Context c){
        return NotificationManagerCompat.from(c).areNotificationsEnabled()&&(Build.VERSION.SDK_INT<33||ContextCompat.checkSelfPermission(c,Manifest.permission.POST_NOTIFICATIONS)==PackageManager.PERMISSION_GRANTED);
    }
    static JSONObject currentTask(JSONObject values,JSONObject event,long now)throws Exception{
        JSONObject config=new JSONObject(values.optString("wb.coach.reminders.v1","{}"));
        if(!config.optBoolean("enabled"))return null;
        String day=event.getString("date"),today=new SimpleDateFormat("yyyy-MM-dd",Locale.ROOT).format(new Date(now));
        if(!day.equals(today)||now<event.getLong("at")-60000||now-event.getLong("at")>4*3600000L)return null;
        String clock=new SimpleDateFormat("HH:mm",Locale.ROOT).format(new Date(now));
        String start=config.optString("quietStart","00:00"),end=config.optString("quietEnd","07:00");
        if(!start.equals(end)&&(start.compareTo(end)<0?clock.compareTo(start)>=0&&clock.compareTo(end)<0:clock.compareTo(start)>=0||clock.compareTo(end)<0))return null;
        JSONArray tasks=new JSONArray(values.optString("wb.tasks.v1","[]")),records=new JSONArray(values.optString("wb.records.v1","[]"));
        JSONObject task=null;
        for(int i=0;i<tasks.length();i++)if(event.getString("taskId").equals(tasks.getJSONObject(i).optString("id")))task=tasks.getJSONObject(i);
        if(task==null||task.optLong("archivedAt",0)>0||!fingerprint(task).equals(event.optString("fingerprint")))return null;
        boolean single=task.optString("recurrence","none").equals("none");
        if(single&&!day.equals(task.optString("scheduledDate")))return null;
        JSONArray excluded=task.optJSONArray("excludedDates");
        if(excluded!=null)for(int i=0;i<excluded.length();i++)if(day.equals(excluded.optString(i)))return null;
        for(int i=0;i<records.length();i++){
            JSONObject record=records.getJSONObject(i);
            if(task.optString("id").equals(record.optString("taskId"))&&(single||day.equals(record.optString("date"))))return null;
        }
        return task;
    }
    static String rule(JSONObject task){return task.optString("recurrence","none")+"|"+task.optString("scheduledDate")+"|"+String.valueOf(task.optJSONArray("weekdays"))+"|"+task.optInt("monthDay");}
    static String fingerprint(JSONObject task)throws Exception{
        byte[] digest=MessageDigest.getInstance("SHA-256").digest((task.optString("title")+"|"+task.optString("scheduledTime")+"|"+rule(task)).getBytes(StandardCharsets.UTF_8));
        StringBuilder out=new StringBuilder();for(byte b:digest)out.append(String.format(Locale.ROOT,"%02x",b&255));return out.toString();
    }
    static void extend(Context context,JSONObject task,JSONObject event)throws Exception{
        String repeat=task.optString("recurrence","none");if(repeat.equals("none"))return;
        SimpleDateFormat dates=new SimpleDateFormat("yyyy-MM-dd",Locale.ROOT),times=new SimpleDateFormat("yyyy-MM-dd HH:mm",Locale.ROOT);
        Calendar day=Calendar.getInstance();day.setTime(dates.parse(event.getString("date")));
        for(int offset=1;offset<=32;offset++){
            day.add(Calendar.DAY_OF_MONTH,1);String date=dates.format(day.getTime());boolean occurs=repeat.equals("daily");
            JSONArray weekdays=task.optJSONArray("weekdays");
            if(repeat.equals("weekly")){occurs=weekdays==null||weekdays.length()==0;if(weekdays!=null)for(int i=0;i<weekdays.length();i++)if(weekdays.getInt(i)==day.get(Calendar.DAY_OF_WEEK)-1)occurs=true;}
            if(repeat.equals("monthly"))occurs=task.optInt("monthDay")==day.get(Calendar.DAY_OF_MONTH);
            String key=task.getString("id")+"@"+date;
            if(occurs&&!prefs(context).contains(key)){
                JSONObject next=new JSONObject();next.put("key",key);next.put("taskId",task.getString("id"));next.put("date",date);next.put("time",task.getString("scheduledTime"));next.put("at",times.parse(date+" "+task.getString("scheduledTime")).getTime());next.put("fingerprint",fingerprint(task));
                prefs(context).edit().putString(key,next.toString()).apply();schedule(context,key,next.getLong("at"));
                if(repeat.equals("monthly")||offset>=14)break;
            }
        }
    }
    @Override public void onReceive(Context context,Intent intent){
        PendingResult pending=goAsync();
        new Thread(()->{try{deliver(context,intent.getStringExtra("key"));}finally{pending.finish();}}).start();
    }
    @SuppressLint("MissingPermission")
    static synchronized void deliver(Context context,String key){
        if(key==null)return;
        try{
            String raw=prefs(context).getString(key,null);if(raw==null)return;
            JSONObject event=new JSONObject(raw),values=PrivateStoragePlugin.readValues(context);
            JSONObject task=currentTask(values,event,System.currentTimeMillis());
            if(task==null||!permitted(context)){cancel(context,key);prefs(context).edit().remove(key).apply();return;}
            extend(context,task,event);
            int stage=event.optInt("stage",0);
            NotificationManager manager=(NotificationManager)context.getSystemService(Context.NOTIFICATION_SERVICE);
            if(Build.VERSION.SDK_INT>=26){NotificationChannel channel=new NotificationChannel(CHANNEL,"自律督促",NotificationManager.IMPORTANCE_HIGH);
            channel.enableVibration(true);channel.setDescription("期待的本地任务提醒，可由小米运动健康转发到手环");manager.createNotificationChannel(channel);}
            Intent open=new Intent(context,MainActivity.class).setAction(QuickChatTileService.ACTION_OPEN_CHAT).setData(Uri.parse("checkin-coach://chat/"+Uri.encode(key))).putExtra("coachTaskId",event.getString("taskId")).putExtra("coachDate",event.getString("date")).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK|Intent.FLAG_ACTIVITY_SINGLE_TOP);
            PendingIntent target=PendingIntent.getActivity(context,0,open,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
            String message=stage==0?"到时间了，这是你定下的安排。现在开始吧。":"这项安排还没有标记完成。现在开始，还是明确改到几点？";
            manager.notify(key,1,new NotificationCompat.Builder(context,CHANNEL).setSmallIcon(R.drawable.ic_quick_chat).setContentTitle(task.getString("title")).setContentText(message).setStyle(new NotificationCompat.BigTextStyle().bigText(message)).setContentIntent(target).setAutoCancel(true).setVisibility(NotificationCompat.VISIBILITY_PRIVATE).setPriority(NotificationCompat.PRIORITY_HIGH).build());
            if(stage<7){
                JSONObject config=new JSONObject(values.optString("wb.coach.reminders.v1","{}"));
                int interval=Math.max(15,Math.min(60,config.optInt("interval",30)));
                long next=System.currentTimeMillis()+interval*60000L;
                if(next-event.getLong("at")<4*3600000L){event.put("stage",stage+1);event.put("nextAt",next);prefs(context).edit().putString(key,event.toString()).apply();schedule(context,key,next);return;}
            }
            // Keep the terminal marker so a foreground refresh cannot repeat the same reminder.
            event.put("finished",true);prefs(context).edit().putString(key,event.toString()).apply();
        }catch(Exception ignored){/* No private data or transport credentials in Android logs. */}
    }
    static synchronized void reconcile(Context context,JSONArray events)throws Exception{
        SharedPreferences preferences=prefs(context);
        for(String key:preferences.getAll().keySet()){
            boolean present=false;
            for(int i=0;i<events.length();i++)if(key.equals(events.getJSONObject(i).getString("key"))){present=true;break;}
            if(!present){cancel(context,key);preferences.edit().remove(key).apply();}
        }
        for(int i=0;i<events.length();i++){
            JSONObject input=events.getJSONObject(i),event=new JSONObject();
            for(String field:new String[]{"key","taskId","date","time","at"})event.put(field,input.get(field));
            JSONObject source=new JSONObject().put("title",input.getString("title")).put("scheduledTime",input.getString("time"));
            byte[] digest=MessageDigest.getInstance("SHA-256").digest((source.getString("title")+"|"+source.getString("scheduledTime")+"|"+input.getString("rule")).getBytes(StandardCharsets.UTF_8));
            StringBuilder hash=new StringBuilder();for(byte b:digest)hash.append(String.format(Locale.ROOT,"%02x",b&255));event.put("fingerprint",hash.toString());
            String key=event.getString("key");
            JSONObject old=new JSONObject(preferences.getString(key,"{}"));
            boolean same=old.optLong("at")==event.getLong("at")&&old.optString("fingerprint").equals(event.getString("fingerprint"));
            if(same&&old.optBoolean("finished"))continue;
            if(same){event.put("stage",old.optInt("stage"));event.put("nextAt",old.optLong("nextAt",event.getLong("at")));}
            else cancel(context,key);
            preferences.edit().putString(key,event.toString()).apply();
            schedule(context,key,Math.max(System.currentTimeMillis()+1000,event.optLong("nextAt",event.getLong("at"))));
        }
    }
    static synchronized void restore(Context context)throws Exception{
        JSONObject values=PrivateStoragePlugin.readValues(context),config=new JSONObject(values.optString("wb.coach.reminders.v1","{}"));
        for(String key:prefs(context).getAll().keySet()){
            JSONObject event=new JSONObject(prefs(context).getString(key,"{}"));
            if(!config.optBoolean("enabled")||event.optLong("at")<System.currentTimeMillis()-4*3600000L){cancel(context,key);prefs(context).edit().remove(key).apply();}
            else if(!event.optBoolean("finished"))schedule(context,key,Math.max(System.currentTimeMillis()+1000,event.optLong("nextAt",event.getLong("at"))));
        }
    }
}
