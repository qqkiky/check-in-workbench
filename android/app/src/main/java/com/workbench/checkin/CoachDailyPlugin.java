package com.workbench.checkin;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import androidx.work.*;
import java.util.concurrent.TimeUnit;
import org.json.JSONArray;
import org.json.JSONObject;

@CapacitorPlugin(name="CoachDaily")
public class CoachDailyPlugin extends Plugin {
 static void schedule(android.content.Context c)throws Exception{
  WorkManager manager=WorkManager.getInstance(c);
  JSONObject values=PrivateStoragePlugin.readValues(c),config=new JSONObject(values.optString("wb.coach.daily.v1","{}"));
  if(!config.optBoolean("enabled")){manager.cancelUniqueWork("coach-daily-periodic");manager.cancelUniqueWork("coach-daily-now");return;}
  Constraints constraints=new Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build();
  manager.enqueueUniquePeriodicWork("coach-daily-periodic",ExistingPeriodicWorkPolicy.KEEP,new PeriodicWorkRequest.Builder(CoachDailyWorker.class,15,TimeUnit.MINUTES).setConstraints(constraints).build());
  manager.enqueueUniqueWork("coach-daily-now",ExistingWorkPolicy.KEEP,new OneTimeWorkRequest.Builder(CoachDailyWorker.class).setConstraints(constraints).build());
 }
 @PluginMethod public void configure(PluginCall call){new Thread(()->{try{schedule(getContext());call.resolve();}catch(Exception e){call.reject("早晚跟进调度未保存，请稍后重试");}}).start();}
 @PluginMethod public void status(PluginCall call){new Thread(()->{try{
  JSONArray rows=CoachDailyStore.read(getContext()).optJSONArray("reports"),recent=new JSONArray();int used=0;
  String today=CoachDailyWorker.date(System.currentTimeMillis());
  if(rows!=null)for(int i=0;i<rows.length();i++){JSONObject r=rows.getJSONObject(i);if(today.equals(r.optString("date")))used++;if(i>=rows.length()-10)recent.put(r);}
  JSObject result=new JSObject();result.put("reports",recent);result.put("used",used);call.resolve(result);
 }catch(Exception e){call.reject("目标跟进记录暂时无法读取");}}).start();}
}
