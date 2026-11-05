package com.workbench.checkin;
import android.Manifest;
import android.app.AlarmManager;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import org.json.JSONArray;
@CapacitorPlugin(name="CoachReminders",permissions={@Permission(alias="notifications",strings={Manifest.permission.POST_NOTIFICATIONS})})
public class CoachRemindersPlugin extends Plugin {
    @PluginMethod public void status(PluginCall call){JSObject out=new JSObject();out.put("granted",CoachReminderReceiver.permitted(getContext()));out.put("exact",Build.VERSION.SDK_INT<31||((AlarmManager)getContext().getSystemService(android.content.Context.ALARM_SERVICE)).canScheduleExactAlarms());call.resolve(out);}
    @PluginMethod public void enable(PluginCall call){if(Build.VERSION.SDK_INT>=33)requestPermissionForAlias("notifications",call,"permissionResult");else status(call);}
    @PermissionCallback private void permissionResult(PluginCall call){status(call);}
    @PluginMethod public void exactSettings(PluginCall call){if(Build.VERSION.SDK_INT>=31)getActivity().startActivity(new Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM,Uri.parse("package:"+getContext().getPackageName())));call.resolve();}
    @android.annotation.SuppressLint("MissingPermission")
    @PluginMethod public void test(PluginCall call){
        if(!CoachReminderReceiver.permitted(getContext())){call.reject("请先允许期待发送通知");return;}
        android.app.NotificationManager manager=(android.app.NotificationManager)getContext().getSystemService(android.content.Context.NOTIFICATION_SERVICE);
        if(Build.VERSION.SDK_INT>=26){android.app.NotificationChannel channel=new android.app.NotificationChannel(CoachReminderReceiver.CHANNEL,"自律督促",android.app.NotificationManager.IMPORTANCE_HIGH);channel.enableVibration(true);manager.createNotificationChannel(channel);}
        Intent open=new Intent(getContext(),MainActivity.class).setAction(QuickChatTileService.ACTION_OPEN_CHAT);
        android.app.PendingIntent target=android.app.PendingIntent.getActivity(getContext(),100,open,android.app.PendingIntent.FLAG_UPDATE_CURRENT|android.app.PendingIntent.FLAG_IMMUTABLE);
        manager.notify("coach-test",0,new androidx.core.app.NotificationCompat.Builder(getContext(),CoachReminderReceiver.CHANNEL).setSmallIcon(R.drawable.ic_quick_chat).setContentTitle("期待 · 通知测试").setContentText("手机通知已发出。请检查手环是否同时振动提醒。").setContentIntent(target).setAutoCancel(true).setVisibility(androidx.core.app.NotificationCompat.VISIBILITY_PRIVATE).build());
        call.resolve();
    }
    @PluginMethod public void sync(PluginCall call){
        new Thread(()->{try{JSONArray events=call.getArray("events");if(events==null||events.length()>3000)throw new IllegalArgumentException();CoachReminderReceiver.reconcile(getContext(),events);call.resolve();}catch(Exception ignored){call.reject("本地提醒未能更新，请保留应用并重试");}}).start();
    }
}
