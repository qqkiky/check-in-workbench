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
            pending=true;
            notifyListeners("openChat",new JSObject(),true);
        }
    }
    @PluginMethod public void consumeLaunch(PluginCall call) {
        getActivity().runOnUiThread(()->{
            JSObject result=new JSObject();result.put("open",pending);pending=false;call.resolve(result);
        });
    }
}
