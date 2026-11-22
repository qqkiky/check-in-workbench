package com.workbench.checkin;
import android.app.Application;
import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.annotation.Config;
import java.text.SimpleDateFormat;
import java.util.Locale;
import static org.junit.Assert.*;

@RunWith(RobolectricTestRunner.class)
@Config(sdk=34,application=Application.class,manifest=Config.NONE)
public class TaskRolloverTest {
    @Test public void unopenedAppPlanKeepsTimeAndOnlyMovesUnfinishedOneOffs() throws Exception {
        JSONArray tasks=new JSONArray()
            .put(new JSONObject("{\"id\":\"one\",\"title\":\"report\",\"recurrence\":\"none\",\"scheduledDate\":\"2026-11-20\",\"scheduledTime\":\"09:15\",\"reminderEnabled\":true,\"reminderLead\":10}"))
            .put(new JSONObject("{\"id\":\"done\",\"recurrence\":\"none\",\"scheduledDate\":\"2026-11-20\",\"scheduledTime\":\"09:15\"}"))
            .put(new JSONObject("{\"id\":\"daily\",\"recurrence\":\"daily\",\"scheduledDate\":\"2026-11-20\",\"scheduledTime\":\"09:15\"}"))
            .put(new JSONObject("{\"id\":\"future\",\"recurrence\":\"none\",\"scheduledDate\":\"2026-11-25\",\"scheduledTime\":\"09:15\"}"));
        JSONObject values=new JSONObject().put("wb.tasks.v1",tasks.toString())
            .put("wb.records.v1","[{\"taskId\":\"done\",\"date\":\"2026-11-20\"}]");
        SimpleDateFormat format=new SimpleDateFormat("yyyy-MM-dd HH:mm",Locale.ROOT);
        JSONArray events=TaskRolloverReceiver.plan(values,format.parse("2026-11-22 00:01").getTime());
        assertEquals(1,events.length());
        JSONObject event=events.getJSONObject(0);
        assertEquals("one@2026-11-22",event.getString("taskId"));
        assertEquals("2026-11-22 09:15",format.format(new java.util.Date(event.getLong("start"))));
        assertEquals(30*60000,event.getLong("end")-event.getLong("start"));
        assertTrue(event.getBoolean("reminderEnabled"));
        assertEquals(10,event.getInt("lead"));
    }
}
