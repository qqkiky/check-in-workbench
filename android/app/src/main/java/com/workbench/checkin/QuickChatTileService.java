package com.workbench.checkin;

import android.app.PendingIntent;
import android.content.Intent;
import android.service.quicksettings.Tile;
import android.service.quicksettings.TileService;
import androidx.core.service.quicksettings.PendingIntentActivityWrapper;
import androidx.core.service.quicksettings.TileServiceCompat;

/** Opens the conversation after unlock; never starts microphone capture. */
public class QuickChatTileService extends TileService {
    public static final String ACTION_OPEN_CHAT="com.workbench.checkin.OPEN_CHAT";

    @Override public void onStartListening() {
        super.onStartListening();
        Tile tile=getQsTile();
        if(tile!=null){tile.setState(Tile.STATE_INACTIVE);tile.updateTile();}
    }
    @Override public void onClick() {
        super.onClick();
        if(isLocked())unlockAndRun(this::openChat);else openChat();
    }
    private void openChat() {
        Intent intent=new Intent(this,MainActivity.class).setAction(ACTION_OPEN_CHAT)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK|Intent.FLAG_ACTIVITY_SINGLE_TOP);
        TileServiceCompat.startActivityAndCollapse(this,
            new PendingIntentActivityWrapper(this,0,intent,PendingIntent.FLAG_UPDATE_CURRENT,false));
    }
}
