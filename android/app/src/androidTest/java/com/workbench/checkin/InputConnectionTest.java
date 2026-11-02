package com.workbench.checkin;

import android.view.inputmethod.EditorInfo;
import android.view.inputmethod.InputConnection;
import android.webkit.WebView;
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
        long end=System.currentTimeMillis()+15000;
        while(System.currentTimeMillis()<end){if("true".equals(eval(expression)))return;Thread.sleep(100);}
        fail("Page condition timed out: "+expression);
    }
    private InputConnection focus(String selector) throws Exception {
        eval("document.querySelector("+JSONObject.quote(selector)+").focus()");
        waitFor("document.activeElement===document.querySelector("+JSONObject.quote(selector)+")");
        AtomicReference<InputConnection> input=new AtomicReference<>();
        InstrumentationRegistry.getInstrumentation().runOnMainSync(()->input.set(web.onCreateInputConnection(new EditorInfo())));
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
            long end=System.currentTimeMillis()+10000;boolean saved=false;
            while(System.currentTimeMillis()<end&&!saved){
                JSONObject values=PrivateStoragePlugin.readValues(InstrumentationRegistry.getInstrumentation().getTargetContext());
                JSONArray tasks=new JSONArray(values.optString("wb.tasks.v1","[]"));
                for(int i=0;i<tasks.length();i++){JSONObject task=tasks.getJSONObject(i);if("键盘回归测试".equals(task.optString("title"))){assertEquals("整理测试资料",task.optString("description"));saved=true;}}
                if(!saved)Thread.sleep(100);
            }
            assertTrue("Native keyboard text never reached the saved task",saved);
        }
    }
}
