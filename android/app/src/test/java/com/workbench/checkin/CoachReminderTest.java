package com.workbench.checkin;
import android.app.Application;
import android.content.Context;
import org.json.JSONObject;
import org.json.JSONArray;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.RuntimeEnvironment;
import org.robolectric.annotation.Config;
import java.text.SimpleDateFormat;
import java.util.Locale;
import static org.junit.Assert.*;
@RunWith(RobolectricTestRunner.class)
@Config(sdk=34,application=Application.class,manifest=Config.NONE)
public class CoachReminderTest {
 Context context;JSONObject task,values,event;long at;
 @Before public void setup()throws Exception{
  context=RuntimeEnvironment.getApplication();context.getSharedPreferences(CoachReminderReceiver.PREFS,0).edit().clear().commit();
  at=new SimpleDateFormat("yyyy-MM-dd HH:mm",Locale.ROOT).parse("2026-11-05 20:00").getTime();
  task=new JSONObject("{id:'read',title:'PrivateTitle',recurrence:'daily',scheduledTime:'20:00'}");
  values=new JSONObject().put("wb.tasks.v1",new JSONArray().put(task).toString()).put("wb.records.v1","[]").put("wb.coach.reminders.v1","{enabled:true,quietStart:'00:00',quietEnd:'07:00'}");
  event=new JSONObject().put("key","read@2026-11-05").put("taskId","read").put("date","2026-11-05").put("time","20:00").put("at",at).put("fingerprint",CoachReminderReceiver.fingerprint(task));
 }
 @Test public void completedTodayStopsRemindersButOtherDaysAndTasksDoNot()throws Exception{
  assertNotNull(CoachReminderReceiver.currentTask(values,event,at));
  values.put("wb.records.v1","[{taskId:'other',date:'2026-11-05'},{taskId:'read',date:'2026-11-04'}]");assertNotNull(CoachReminderReceiver.currentTask(values,event,at));
  values.put("wb.records.v1","[{taskId:'read',date:'2026-11-05'}]");assertNull(CoachReminderReceiver.currentTask(values,event,at));
 }
 @Test public void editsDeletionArchivalAndDisableInvalidateOldAlarm()throws Exception{
  task.put("scheduledTime","21:00");values.put("wb.tasks.v1",new JSONArray().put(task).toString());assertNull(CoachReminderReceiver.currentTask(values,event,at));
  task.put("scheduledTime","20:00").put("title","New title");values.put("wb.tasks.v1",new JSONArray().put(task).toString());assertNull(CoachReminderReceiver.currentTask(values,event,at));
  values.put("wb.tasks.v1","[]");assertNull(CoachReminderReceiver.currentTask(values,event,at));
  values.put("wb.tasks.v1",new JSONArray().put(task).toString()).put("wb.coach.reminders.v1","{enabled:false}");assertNull(CoachReminderReceiver.currentTask(values,event,at));
 }
 @Test public void quietHoursWrongDayAndExpiredFollowupsNeverNotify()throws Exception{
  values.put("wb.coach.reminders.v1","{enabled:true,quietStart:'19:00',quietEnd:'08:00'}");assertNull(CoachReminderReceiver.currentTask(values,event,at));
  values.put("wb.coach.reminders.v1","{enabled:true,quietStart:'00:00',quietEnd:'07:00'}");assertNull(CoachReminderReceiver.currentTask(values,event,at+86400000L));assertNull(CoachReminderReceiver.currentTask(values,event,at+5*3600000L));
 }
 @Test public void alarmStorageOmitsTaskTextAndRefreshingDoesNotResetFollowupStage()throws Exception{
  JSONObject input=new JSONObject(event.toString()).put("title","PrivateTitle").put("rule",CoachReminderReceiver.rule(task));
  CoachReminderReceiver.reconcile(context,new JSONArray().put(input));
  String raw=CoachReminderReceiver.prefs(context).getString(event.getString("key"),"");assertFalse(raw.contains("PrivateTitle"));assertNotNull(CoachReminderReceiver.currentTask(values,new JSONObject(raw),at));
  JSONObject saved=new JSONObject(raw).put("stage",3).put("nextAt",at+1800000L);CoachReminderReceiver.prefs(context).edit().putString(event.getString("key"),saved.toString()).commit();
  CoachReminderReceiver.reconcile(context,new JSONArray().put(input));
  assertEquals(3,new JSONObject(CoachReminderReceiver.prefs(context).getString(event.getString("key"),"")).getInt("stage"));
  CoachReminderReceiver.reconcile(context,new JSONArray());assertEquals(0,CoachReminderReceiver.prefs(context).getAll().size());
 }
 @Test public void recurringAlarmExtendsFutureOccurrencesWithoutPrivateText()throws Exception{
  CoachReminderReceiver.extend(context,task,event);
  assertTrue(CoachReminderReceiver.prefs(context).contains("read@2026-11-06"));
  for(Object value:CoachReminderReceiver.prefs(context).getAll().values())assertFalse(value.toString().contains("PrivateTitle"));
 }
}
