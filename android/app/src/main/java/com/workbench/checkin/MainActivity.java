package com.workbench.checkin;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // 注入自定义原生插件（含 TaskCalendar 日历提醒）
        registerPlugin(TaskCalendarPlugin.class);
        registerPlugin(PrivateStoragePlugin.class);
        registerPlugin(AssistantBackgroundPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
