package com.workbench.checkin;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.net.URL;
import java.net.HttpURLConnection;
import java.io.InputStream;
import java.io.ByteArrayOutputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

/** Personal BYOK requests; never log credentials or follow redirects with them. */
@CapacitorPlugin(name="AgentHttp")
public class AgentHttpPlugin extends Plugin {
    @PluginMethod
    public void request(PluginCall call) {
        new Thread(() -> {
            HttpURLConnection connection=null;
            try {
                URL url=new URL(call.getString("url", ""));
                String key=call.getString("key", "");
                JSObject body=call.getObject("body");
                if(!"https".equals(url.getProtocol()) || url.getUserInfo()!=null || url.getQuery()!=null || url.getRef()!=null || !url.getPath().endsWith("/chat/completions") || key.isEmpty() || key.contains("\r") || key.contains("\n") || body==null) {
                    call.reject("AI 服务配置不正确");return;
                }
                connection=(HttpURLConnection)url.openConnection();
                connection.setInstanceFollowRedirects(false);
                connection.setConnectTimeout(15000);connection.setReadTimeout(90000);
                connection.setRequestMethod("POST");connection.setDoOutput(true);
                connection.setRequestProperty("Authorization","Bearer "+key);
                connection.setRequestProperty("Content-Type","application/json");
                try(OutputStream output=connection.getOutputStream()){output.write(body.toString().getBytes(StandardCharsets.UTF_8));}
                int status=connection.getResponseCode();
                if(status<200 || status>=300){call.reject("AI 服务请求失败（"+status+"），请检查地址、密钥、模型和服务额度");return;}
                ByteArrayOutputStream bytes=new ByteArrayOutputStream();
                try(InputStream input=connection.getInputStream()){
                    byte[] buffer=new byte[8192];int length;
                    while((length=input.read(buffer))!=-1){if(bytes.size()+length>1048576)throw new IllegalStateException();bytes.write(buffer,0,length);}
                }
                call.resolve(new JSObject(bytes.toString(StandardCharsets.UTF_8.name())));
            } catch(Exception error){call.reject("AI 请求未完成，请检查网络和接口配置；未自动重试");}
            finally{if(connection!=null)connection.disconnect();}
        }).start();
    }
}
