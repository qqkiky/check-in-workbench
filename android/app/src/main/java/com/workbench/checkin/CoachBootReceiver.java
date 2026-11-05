package com.workbench.checkin;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
public class CoachBootReceiver extends BroadcastReceiver {
 @Override public void onReceive(Context context,Intent intent){PendingResult pending=goAsync();new Thread(()->{try{CoachReminderReceiver.restore(context);}catch(Exception ignored){}finally{pending.finish();}}).start();}
}
