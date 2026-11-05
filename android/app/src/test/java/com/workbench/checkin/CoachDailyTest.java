package com.workbench.checkin;

import android.app.Application;
import java.text.SimpleDateFormat;
import java.util.Locale;
import org.json.JSONObject;
import org.json.JSONArray;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.annotation.Config;
import static org.junit.Assert.*;

@RunWith(RobolectricTestRunner.class)
@Config(sdk=34,application=Application.class,manifest=Config.NONE)
public class CoachDailyTest {
 @Test public void failedOrInterruptedSlotCannotChargeAgainAndDayResets()throws Exception{
  JSONObject state=new JSONObject();
  assertTrue(CoachDailyStore.reserve(state,"2026-11-06","morning",1));
  state=new JSONObject(state.toString());
  assertFalse(CoachDailyStore.reserve(state,"2026-11-06","morning",2));
  state.getJSONArray("reports").getJSONObject(0).put("status","failed");
  assertFalse(CoachDailyStore.reserve(state,"2026-11-06","morning",3));
  assertTrue(CoachDailyStore.reserve(state,"2026-11-06","evening",4));
  assertFalse(CoachDailyStore.reserve(state,"2026-11-06","extra",5));
  assertTrue(CoachDailyStore.reserve(state,"2026-11-07","morning",6));
 }
 @Test public void scheduleOnlyRunsInAConfiguredSlot()throws Exception{
  JSONObject config=new JSONObject("{enabled:true,morning:'08:00',evening:'21:00'}");
  SimpleDateFormat clock=new SimpleDateFormat("yyyy-MM-dd HH:mm",Locale.ROOT);
  assertEquals("",CoachDailyWorker.slot(config,clock.parse("2026-11-06 07:59").getTime()));
  assertEquals("morning",CoachDailyWorker.slot(config,clock.parse("2026-11-06 08:00").getTime()));
  assertEquals("evening",CoachDailyWorker.slot(config,clock.parse("2026-11-06 21:05").getTime()));
  assertEquals("",CoachDailyWorker.slot(config.put("enabled",false),clock.parse("2026-11-06 21:05").getTime()));
 }
 @Test public void requestSnapshotContainsRealCheckInsAndNoPrivateDetails()throws Exception{
  JSONObject values=new JSONObject()
   .put("wb.coach.memories.v1","[{id:'g',kind:'goal',content:'Train',updatedAt:1}]")
   .put("wb.coach.goals.v1","[{id:'goal',sourceMemoryId:'g',title:'Training',taskIds:['t']}]")
   .put("wb.tasks.v1","[{id:'t',title:'Exercise',recurrence:'daily',description:'PRIVATE_TASK_NOTE'},{id:'old',title:'PRIVATE_ARCHIVED',archivedAt:1}]")
   .put("wb.records.v1","[{taskId:'t',date:'2026-11-06',note:'PRIVATE_RECORD_NOTE'},{taskId:'t',date:'2026-11-07'}]")
   .put("wb.notes.v1","PRIVATE_NOTE").put("wb.acct.accounts.v1","PRIVATE_ACCOUNT").put("wb.assistant.agent.connection.v1","PRIVATE_API_KEY");
  JSONObject snapshot=CoachDailyWorker.snapshot(values,"2026-11-06");
  assertFalse(snapshot.toString().contains("PRIVATE"));
  JSONArray tasks=snapshot.getJSONArray("tasks");
  assertEquals(1,tasks.length());
  assertEquals("2026-11-06",tasks.getJSONObject(0).getJSONArray("completedDates").getString(0));
  assertEquals(1,tasks.getJSONObject(0).getJSONArray("completedDates").length());
  assertEquals("g",snapshot.getJSONArray("goals").getJSONObject(0).getString("sourceMemoryId"));
 }
}
