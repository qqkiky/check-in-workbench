package com.workbench.checkin;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.Bridge;
import java.util.ArrayList;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // 注入自定义原生插件（含 TaskCalendar 日历提醒）
        this.init(savedInstanceState, new ArrayList<Class<? extends com.getcapacitor.Plugin>>() {{
            add(TaskCalendarPlugin.class);
        }});
    }
}
