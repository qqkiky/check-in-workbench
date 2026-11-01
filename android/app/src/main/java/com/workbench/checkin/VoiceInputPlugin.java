package com.workbench.checkin;

import android.Manifest;
import android.content.Intent;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import java.util.ArrayList;

/** Only a user-held, foreground session. No audio files, background capture or logging. */
@CapacitorPlugin(name="VoiceInput",permissions={@Permission(strings={Manifest.permission.RECORD_AUDIO},alias="microphone")})
public class VoiceInputPlugin extends Plugin {
    private final Handler main=new Handler(Looper.getMainLooper());
    private SpeechRecognizer recognizer;
    private PluginCall pending;
    private String sessionId;
    private boolean stopping;
    private final ArrayList<String> parts=new ArrayList<>();
    private final Runnable restart=this::listen;
    private final Runnable limit=this::stopSession;
    private final Runnable resultTimeout=()->fail("语音识别超时，未发送，请重试");

    @PluginMethod
    public void status(PluginCall call) {
        main.post(()->{
            JSObject result=new JSObject();
            result.put("available",SpeechRecognizer.isRecognitionAvailable(getContext()));
            result.put("granted",PermissionState.GRANTED.equals(getPermissionState("microphone")));
            call.resolve(result);
        });
    }
    @PluginMethod
    public void requestMicrophone(PluginCall call) {
        if(PermissionState.GRANTED.equals(getPermissionState("microphone")))microphoneResult(call);
        else requestPermissionForAlias("microphone",call,"microphoneResult");
    }
    @PermissionCallback
    private void microphoneResult(PluginCall call) {
        JSObject result=new JSObject();result.put("granted",PermissionState.GRANTED.equals(getPermissionState("microphone")));call.resolve(result);
    }
    @PluginMethod
    public void start(PluginCall call) {
        main.post(()->{
            if(pending!=null){call.reject("正在识别上一条语音，请稍候");return;}
            if(!PermissionState.GRANTED.equals(getPermissionState("microphone"))){call.reject("请先允许麦克风权限");return;}
            if(!SpeechRecognizer.isRecognitionAvailable(getContext())){call.reject("没有可用的系统语音识别服务");return;}
            String id=call.getString("sessionId","");
            if(id.isEmpty()){call.reject("语音会话无效");return;}
            pending=call;sessionId=id;stopping=false;parts.clear();
            main.postDelayed(limit,60000);listen();
        });
    }
    @PluginMethod
    public void stop(PluginCall call) {
        main.post(()->{if(call.getString("sessionId","").equals(sessionId))stopSession();call.resolve();});
    }
    @PluginMethod
    public void cancel(PluginCall call) {
        main.post(()->{if(call.getString("sessionId","").equals(sessionId))fail("录音已取消，未发送");call.resolve();});
    }
    private void listen() {
        if(pending==null||stopping)return;
        try {
            final SpeechRecognizer current=SpeechRecognizer.createSpeechRecognizer(getContext());
            recognizer=current;
            current.setRecognitionListener(new RecognitionListener(){
                private boolean heard;
                private boolean active(){return pending!=null&&recognizer==current;}
                @Override public void onReadyForSpeech(Bundle params){}
                @Override public void onBeginningOfSpeech(){heard=true;}
                @Override public void onRmsChanged(float rms){}
                @Override public void onBufferReceived(byte[] bytes){}
                @Override public void onEndOfSpeech(){}
                @Override public void onPartialResults(Bundle results){ArrayList<String> words=results.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);if(words!=null&&!words.isEmpty()&&!words.get(0).trim().isEmpty())heard=true;}
                @Override public void onEvent(int type,Bundle params){}
                @Override public void onResults(Bundle results){
                    if(!active())return;
                    ArrayList<String> words=results.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
                    String text=words!=null&&!words.isEmpty()?words.get(0).trim():"";
                    if(!text.isEmpty())parts.add(text);
                    else if(heard){fail("这段语音没有识别完整，未发送，请重试");return;}
                    destroyRecognizer();
                    if(stopping)finish();else main.postDelayed(restart,200);
                }
                @Override public void onError(int code){
                    if(!active())return;
                    if(!heard&&(code==SpeechRecognizer.ERROR_NO_MATCH||code==SpeechRecognizer.ERROR_SPEECH_TIMEOUT)) {
                        destroyRecognizer();if(stopping)finish();else main.postDelayed(restart,200);return;
                    }
                    String message=code==SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS?"请允许麦克风权限":code==SpeechRecognizer.ERROR_NETWORK||code==SpeechRecognizer.ERROR_NETWORK_TIMEOUT?"系统语音识别网络异常":code==SpeechRecognizer.ERROR_LANGUAGE_NOT_SUPPORTED||code==SpeechRecognizer.ERROR_LANGUAGE_UNAVAILABLE?"系统语音服务暂不支持中文，请检查语音服务或语言包":"系统语音识别失败，请重试";
                    fail(message+"；本条语音未发送");
                }
            });
            Intent intent=new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
            intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL,RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
            intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE,"zh-CN");
            intent.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS,true);
            intent.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS,1);
            intent.putExtra(RecognizerIntent.EXTRA_PREFER_OFFLINE,true);
            current.startListening(intent);
        } catch(Exception error){fail("系统语音识别无法启动，未发送，请检查麦克风和语音服务");}
    }
    private void stopSession() {
        if(pending==null||stopping)return;
        stopping=true;main.removeCallbacks(restart);main.removeCallbacks(limit);
        if(recognizer==null){finish();return;}
        main.postDelayed(resultTimeout,8000);
        try{recognizer.stopListening();}catch(Exception error){fail("语音识别没有正常结束，未发送，请重试");}
    }
    private void finish() {
        if(pending==null)return;
        StringBuilder text=new StringBuilder();for(String part:parts){if(text.length()>0)text.append(' ');text.append(part);}
        PluginCall call=pending;clear();
        if(text.length()==0){call.reject("没有识别到清楚的语音，未发送，请按住后再说话");return;}
        if(text.length()>4000){call.reject("语音太长，未发送，请分段说");return;}
        JSObject result=new JSObject();result.put("text",text.toString());call.resolve(result);
    }
    private void fail(String message) {PluginCall call=pending;clear();if(call!=null)call.reject(message);}
    private void destroyRecognizer() {
        SpeechRecognizer current=recognizer;recognizer=null;
        if(current!=null){
            try{current.cancel();}catch(RuntimeException ignored){}
            try{current.destroy();}catch(RuntimeException ignored){}
        }
    }
    private void clear() {
        pending=null;sessionId=null;stopping=false;parts.clear();
        main.removeCallbacks(restart);main.removeCallbacks(limit);main.removeCallbacks(resultTimeout);destroyRecognizer();
    }
    @Override protected void handleOnPause(){main.post(()->fail("已离开前台，录音已取消，未发送"));}
    @Override protected void handleOnDestroy(){main.post(()->fail("录音已取消，未发送"));}
}
