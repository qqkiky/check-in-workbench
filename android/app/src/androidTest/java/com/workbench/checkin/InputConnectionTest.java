package com.workbench.checkin;

import android.view.inputmethod.EditorInfo;
import android.view.inputmethod.InputConnection;
import android.webkit.WebView;
import android.os.SystemClock;
import android.view.MotionEvent;
import android.view.InputDevice;
import android.Manifest;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.ContentUris;
import android.content.Context;
import android.database.Cursor;
import android.net.Uri;
import android.provider.CalendarContract;
import android.provider.CalendarContract.Calendars;
import android.provider.CalendarContract.Events;
import androidx.lifecycle.Lifecycle;
import java.util.TimeZone;
import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.Test;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;

/** Uses Chromium's real Android InputConnection, not injected DOM input events. */
@RunWith(AndroidJUnit4.class)
public class InputConnectionTest {
    private WebView web;
    private String eval(String script) throws Exception {
        CountDownLatch latch=new CountDownLatch(1);AtomicReference<String> value=new AtomicReference<>();
        InstrumentationRegistry.getInstrumentation().runOnMainSync(()->web.evaluateJavascript(script,result->{value.set(result);latch.countDown();}));
        assertTrue("WebView script timed out",latch.await(10,TimeUnit.SECONDS));return value.get();
    }
    private void waitFor(String expression) throws Exception {
        long end=System.currentTimeMillis()+30000;
        while(System.currentTimeMillis()<end){if("true".equals(eval(expression)))return;Thread.sleep(100);}
        fail("Page condition timed out: "+expression);
    }
    private InputConnection focus(String selector) throws Exception {
        Thread.sleep(400); // Let the modal and keyboard resize settle before a physical tap.
        JSONArray position=new JSONArray(eval("(()=>{const r=document.querySelector("+JSONObject.quote(selector)+").getBoundingClientRect();return [r.x+r.width/2,r.y+r.height/2,devicePixelRatio]})()"));
        int[] offset=new int[2];InstrumentationRegistry.getInstrumentation().runOnMainSync(()->web.getLocationOnScreen(offset));
        float x=offset[0]+(float)(position.getDouble(0)*position.getDouble(2)),y=offset[1]+(float)(position.getDouble(1)*position.getDouble(2));
        long time=SystemClock.uptimeMillis();
        for(int action:new int[]{MotionEvent.ACTION_DOWN,MotionEvent.ACTION_UP}){
            MotionEvent event=MotionEvent.obtain(time,SystemClock.uptimeMillis(),action,x,y,0);event.setSource(InputDevice.SOURCE_TOUCHSCREEN);
            InstrumentationRegistry.getInstrumentation().sendPointerSync(event);event.recycle();
        }
        waitFor("document.activeElement===document.querySelector("+JSONObject.quote(selector)+")");
        AtomicReference<InputConnection> input=new AtomicReference<>();
        long end=System.currentTimeMillis()+10000;
        while(input.get()==null&&System.currentTimeMillis()<end){
            InstrumentationRegistry.getInstrumentation().waitForIdleSync();
            InstrumentationRegistry.getInstrumentation().runOnMainSync(()->input.set(web.onCreateInputConnection(new EditorInfo())));
            if(input.get()==null)Thread.sleep(100);
        }
        assertNotNull("No native editor input connection",input.get());return input.get();
    }
    private void commit(InputConnection input,String text) {
        InstrumentationRegistry.getInstrumentation().runOnMainSync(()->assertTrue(input.commitText(text,1)));
    }
    @Test public void chineseTextAndMiddleInsertionSaveThroughNativeKeyboardConnection() throws Exception {
        try(ActivityScenario<MainActivity> scenario=ActivityScenario.launch(MainActivity.class)) {
            scenario.onActivity(activity->web=activity.getBridge().getWebView());
            waitFor("!!document.querySelector('[aria-label=\"新增任务\"]')");
            eval("document.querySelector('[aria-label=\"新增任务\"]').click()");
            String title="input[placeholder='如：阅读 30 分钟']",note="textarea[placeholder='补充说明']";
            waitFor("!!document.querySelector("+JSONObject.quote(title)+")");
            commit(focus(title),"键盘回归测试");
            waitFor("document.querySelector("+JSONObject.quote(title)+").value==='键盘回归测试'");
            InputConnection input=focus(note);commit(input,"整理资料");
            waitFor("document.querySelector("+JSONObject.quote(note)+").value==='整理资料'");
            InstrumentationRegistry.getInstrumentation().runOnMainSync(()->assertTrue(input.setSelection(2,2)));
            waitFor("document.querySelector("+JSONObject.quote(note)+").selectionStart===2");
            commit(input,"测试");
            waitFor("document.querySelector("+JSONObject.quote(note)+").value==='整理测试资料'");
            eval("[...document.querySelectorAll('.modal-content button')].find(button=>button.textContent.trim()==='添加').click()");
            waitFor("!document.querySelector("+JSONObject.quote(title)+")");
            long end=System.currentTimeMillis()+10000;boolean saved=false;String savedTitles="";
            while(System.currentTimeMillis()<end&&!saved){
                JSONObject values=PrivateStoragePlugin.readValues(InstrumentationRegistry.getInstrumentation().getTargetContext());
                JSONArray tasks=new JSONArray(values.optString("wb.tasks.v1","[]"));
                JSONArray titles=new JSONArray();
                for(int i=0;i<tasks.length();i++){JSONObject task=tasks.getJSONObject(i);titles.put(task.optString("title"));if("键盘回归测试".equals(task.optString("title"))){assertEquals("整理测试资料",task.optString("description"));saved=true;}}
                savedTitles=titles.toString();
                if(!saved)Thread.sleep(100);
            }
            assertTrue("Native keyboard text never reached the saved task; titles="+savedTitles+"; platform="+eval("window.Capacitor.getPlatform()"),saved);
        }
    }
    private String eventTitle(ContentResolver resolver,long id) {
        try(Cursor cursor=resolver.query(ContentUris.withAppendedId(Events.CONTENT_URI,id),new String[]{Events.TITLE},null,null,null)){
            return cursor!=null&&cursor.moveToFirst()?cursor.getString(0):"";
        }
    }
    @Test public void selectedLocalCalendarImportsAndManualEditsSyncBothWays() throws Exception {
        Context context=InstrumentationRegistry.getInstrumentation().getTargetContext();
        InstrumentationRegistry.getInstrumentation().getUiAutomation().grantRuntimePermission(context.getPackageName(),Manifest.permission.READ_CALENDAR);
        InstrumentationRegistry.getInstrumentation().getUiAutomation().grantRuntimePermission(context.getPackageName(),Manifest.permission.WRITE_CALENDAR);
        ContentResolver resolver=context.getContentResolver();
        Uri calendars=Calendars.CONTENT_URI.buildUpon().appendQueryParameter(CalendarContract.CALLER_IS_SYNCADAPTER,"true")
            .appendQueryParameter(Calendars.ACCOUNT_NAME,"calendar-e2e").appendQueryParameter(Calendars.ACCOUNT_TYPE,CalendarContract.ACCOUNT_TYPE_LOCAL).build();
        ContentValues calendar=new ContentValues();calendar.put(Calendars.ACCOUNT_NAME,"calendar-e2e");calendar.put(Calendars.ACCOUNT_TYPE,CalendarContract.ACCOUNT_TYPE_LOCAL);
        calendar.put(Calendars.NAME,"xiaoai-test");calendar.put(Calendars.CALENDAR_DISPLAY_NAME,"小爱同步测试");calendar.put(Calendars.CALENDAR_ACCESS_LEVEL,Calendars.CAL_ACCESS_OWNER);
        calendar.put(Calendars.OWNER_ACCOUNT,"test@local");calendar.put(Calendars.VISIBLE,1);calendar.put(Calendars.SYNC_EVENTS,1);
        long calendarId=ContentUris.parseId(resolver.insert(calendars,calendar));
        ContentValues event=new ContentValues();event.put(Events.CALENDAR_ID,calendarId);event.put(Events.TITLE,"小爱日历回归");event.put(Events.DESCRIPTION,"保留原日历备注");
        java.util.Calendar noon=java.util.Calendar.getInstance();noon.set(java.util.Calendar.HOUR_OF_DAY,12);noon.set(java.util.Calendar.MINUTE,0);noon.set(java.util.Calendar.SECOND,0);noon.set(java.util.Calendar.MILLISECOND,0);
        event.put(Events.DTSTART,noon.getTimeInMillis());event.put(Events.DTEND,noon.getTimeInMillis()+1800000);event.put(Events.EVENT_TIMEZONE,TimeZone.getDefault().getID());
        long eventId=ContentUris.parseId(resolver.insert(Events.CONTENT_URI,event));
        try(ActivityScenario<MainActivity> scenario=ActivityScenario.launch(MainActivity.class)) {
            scenario.onActivity(activity->web=activity.getBridge().getWebView());
            waitFor("!!document.querySelector('nav')");
            eval("[...document.querySelectorAll('nav button')].find(button=>button.textContent.trim()==='更多').click()");
            waitFor("[...document.querySelectorAll('button')].some(button=>button.textContent.includes('小爱日历导入'))");
            eval("[...document.querySelectorAll('button')].find(button=>button.textContent.includes('小爱日历导入')).click()");
            waitFor("[...document.querySelectorAll('label')].some(label=>label.textContent.includes('小爱同步测试'))");
            eval("[...document.querySelectorAll('label')].find(label=>label.textContent.includes('小爱同步测试')).querySelector('input').click()");
            eval("[...document.querySelectorAll('button')].find(button=>button.textContent.trim()==='保存来源并同步').click()");
            waitFor("!document.querySelector('.modal-content')");
            eval("[...document.querySelectorAll('nav button')].find(button=>button.textContent.trim()==='今日').click()");
            waitFor("document.body.textContent.includes('小爱日历回归')");
            ContentValues edit=new ContentValues();edit.put(Events.TITLE,"小爱修改后");resolver.update(ContentUris.withAppendedId(Events.CONTENT_URI,eventId),edit,null,null);
            waitFor("document.body.textContent.includes('小爱修改后')");
            eval("document.querySelector('[aria-label=\"编辑任务：小爱修改后\"]').click()");
            String title="input[placeholder='如：阅读 30 分钟']";InputConnection input=focus(title);
            InstrumentationRegistry.getInstrumentation().runOnMainSync(()->input.setSelection(0,"小爱修改后".length()));
            waitFor("document.querySelector("+JSONObject.quote(title)+").selectionStart===0&&document.querySelector("+JSONObject.quote(title)+").selectionEnd===5");commit(input,"期待手动改名");
            waitFor("document.querySelector("+JSONObject.quote(title)+").value==='期待手动改名'");
            eval("[...document.querySelectorAll('.modal-content button')].find(button=>button.textContent.trim()==='保存').click()");
            long end=System.currentTimeMillis()+30000;
            while(System.currentTimeMillis()<end&&!"期待手动改名".equals(eventTitle(resolver,eventId)))Thread.sleep(100);
            assertEquals("期待手动改名",eventTitle(resolver,eventId));
            try(Cursor cursor=resolver.query(Events.CONTENT_URI,new String[]{Events._ID},Events.TITLE+"=? AND "+Events.DELETED+"=0",new String[]{"期待手动改名"},null)){assertEquals(1,cursor.getCount());}
            try(Cursor cursor=resolver.query(ContentUris.withAppendedId(Events.CONTENT_URI,eventId),new String[]{Events.CALENDAR_ID,Events.DESCRIPTION},null,null,null)){
                assertTrue(cursor.moveToFirst());assertEquals(calendarId,cursor.getLong(0));assertEquals("保留原日历备注",cursor.getString(1));
            }
            scenario.moveToState(Lifecycle.State.CREATED);event.put(Events.TITLE,"小爱第二条");resolver.insert(Events.CONTENT_URI,event);scenario.moveToState(Lifecycle.State.RESUMED);
            waitFor("document.body.textContent.includes('小爱第二条')");
        }finally{
            synchronized(CalendarRepository.class){new CalendarRepository(context).selectCalendars(new JSONArray());}
            resolver.delete(ContentUris.withAppendedId(calendars,calendarId),null,null);
        }
    }
}
