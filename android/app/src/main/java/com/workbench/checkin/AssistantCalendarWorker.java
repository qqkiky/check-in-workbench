package com.workbench.checkin;
import android.Manifest;
import android.content.Context;
import android.content.pm.PackageManager;
import androidx.annotation.NonNull;
import androidx.core.content.ContextCompat;
import androidx.work.Worker;
import androidx.work.WorkerParameters;
import java.net.URL;
import java.net.HttpURLConnection;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.text.SimpleDateFormat;
import java.util.Locale;
import java.util.TimeZone;
import org.json.JSONObject;
import org.json.JSONArray;

/** Best effort, normally no sooner than 15 minutes; Xiaomi power policy may delay it. */
public class AssistantCalendarWorker extends Worker {
    public AssistantCalendarWorker(@NonNull Context context,@NonNull WorkerParameters params){super(context,params);}
    @NonNull @Override public Result doWork(){
        HttpURLConnection connection=null;
        try {
            Context context=getApplicationContext();
            JSONObject values=PrivateStoragePlugin.readValues(context);
            JSONObject config=new JSONObject(values.optString("wb.assistant.connection.v1","{}"));
            if(!config.optBoolean("enabled") || !"1".equals(values.optString("wb.calendar.enabled.v1")))return Result.success();
            if(ContextCompat.checkSelfPermission(context,Manifest.permission.READ_CALENDAR)!=PackageManager.PERMISSION_GRANTED
                ||ContextCompat.checkSelfPermission(context,Manifest.permission.WRITE_CALENDAR)!=PackageManager.PERMISSION_GRANTED)return Result.success();
            URL base=new URL(config.getString("url"));
            if(!"https".equals(base.getProtocol())||base.getUserInfo()!=null||base.getQuery()!=null||base.getRef()!=null)return Result.failure();
            connection=(HttpURLConnection)new URL(base.getProtocol(),base.getHost(),base.getPort(),"/v1/schedules").openConnection();
            connection.setInstanceFollowRedirects(false);connection.setConnectTimeout(15000);connection.setReadTimeout(15000);
            connection.setRequestProperty("Authorization","Bearer "+config.getString("token"));
            if(connection.getResponseCode()!=200)return Result.retry();
            byte[] buffer=new byte[4096];ByteArrayOutputStream output=new ByteArrayOutputStream();
            try(InputStream input=connection.getInputStream()){
                int count;while((count=input.read(buffer))!=-1){if(output.size()+count>1000000)return Result.failure();output.write(buffer,0,count);}
            }
            JSONArray tasks=new JSONObject(output.toString("UTF-8")).getJSONArray("tasks");
            SimpleDateFormat format=new SimpleDateFormat("yyyy-MM-dd HH:mm",Locale.ROOT);
            format.setTimeZone(TimeZone.getTimeZone("Asia/Shanghai"));format.setLenient(false);
            synchronized(CalendarRepository.class){
                CalendarRepository calendar=new CalendarRepository(context);
                for(int i=0;i<Math.min(tasks.length(),2000);i++){
                    JSONObject task=tasks.getJSONObject(i);
                    String id=task.getString("id"),date=task.getString("date"),time=task.getString("time"),status=task.getString("status");
                    if(!id.matches("[A-Za-z0-9_-]{1,100}")||!date.matches("\\d{4}-\\d{2}-\\d{2}")||!time.matches("([01]\\d|2[0-3]):[0-5]\\d"))continue;
                    if(!status.equals("pending")&&!status.equals("completed")&&!status.equals("cancelled"))continue;
                    String currentKey=id+"@"+date;
                    for(String key:context.getSharedPreferences("calendar-events",0).getAll().keySet()){
                        if(key.startsWith(id+"@")&&(!key.equals(currentKey)||status.equals("cancelled")))calendar.deleteEvent(key);
                    }
                    if(status.equals("cancelled"))continue;
                    long start=format.parse(date+" "+time).getTime();
                    int duration=Math.max(1,Math.min(1440,task.optInt("duration",30)));
                    String title=task.getString("title");if(title.length()>200)continue;
                    calendar.upsertEvent(currentKey,title,start,start+duration*60000L,0,"来自工作台日程助手",status.equals("completed"),true);
                }
            }
            return Result.success();
        }catch(Exception e){return Result.retry();}
        finally{if(connection!=null)connection.disconnect();}
    }
}
