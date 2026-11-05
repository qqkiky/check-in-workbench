package com.workbench.checkin;

import android.content.Intent;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name="QuickChat")
public class QuickChatPlugin extends Plugin {
    private boolean pending;

    @Override protected void handleOnNewIntent(Intent intent) {
        if(intent!=null&&QuickChatTileService.ACTION_OPEN_CHAT.equals(intent.getAction())) {
            getActivity().setIntent(intent);
            pending=true;
            notifyListeners("openChat",new JSObject(),true);
        }
    }
    @PluginMethod public void consumeLaunch(PluginCall call) {
        getActivity().runOnUiThread(()->{
            Intent intent=getActivity().getIntent();boolean open=pending||(intent!=null&&QuickChatTileService.ACTION_OPEN_CHAT.equals(intent.getAction()));
            JSObject result=new JSObject();result.put("open",open);
            if(open&&intent!=null){result.put("taskId",intent.getStringExtra("coachTaskId"));result.put("date",intent.getStringExtra("coachDate"));intent.setAction(null);intent.removeExtra("coachTaskId");intent.removeExtra("coachDate");}
            pending=false;call.resolve(result);
        });
    }
}
