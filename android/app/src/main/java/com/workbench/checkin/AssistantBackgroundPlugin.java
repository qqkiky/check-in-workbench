package com.workbench.checkin;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import androidx.work.Constraints;
import androidx.work.NetworkType;
import androidx.work.PeriodicWorkRequest;
import androidx.work.WorkManager;
import androidx.work.ExistingPeriodicWorkPolicy;
import androidx.work.OneTimeWorkRequest;
import java.util.concurrent.TimeUnit;

@CapacitorPlugin(name="AssistantBackground")
public class AssistantBackgroundPlugin extends Plugin {
    @PluginMethod
    public void configure(PluginCall call) {
        WorkManager manager=WorkManager.getInstance(getContext());
        if (!Boolean.TRUE.equals(call.getBoolean("enabled",false))) {
            manager.cancelUniqueWork("assistant-calendar");call.resolve();return;
        }
        Constraints constraints=new Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build();
        PeriodicWorkRequest periodic=new PeriodicWorkRequest.Builder(AssistantCalendarWorker.class,15,TimeUnit.MINUTES)
                .setConstraints(constraints).build();
        manager.enqueueUniquePeriodicWork("assistant-calendar",ExistingPeriodicWorkPolicy.KEEP,periodic);
        manager.enqueue(new OneTimeWorkRequest.Builder(AssistantCalendarWorker.class).setConstraints(constraints).build());
        call.resolve();
    }
}
