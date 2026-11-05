package com.workbench.checkin;
import android.content.Context;
import android.util.AtomicFile;
import android.util.Base64;
import java.io.File;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import javax.crypto.Cipher;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;
import org.json.JSONArray;
import org.json.JSONObject;

/** Separate from workbench.enc: a background write must never overwrite WebView's cached data. */
final class CoachDailyStore {
 private static AtomicFile file(Context c){return new AtomicFile(new File(c.getNoBackupFilesDir(),"coach-daily.enc"));}
 private static SecretKey key()throws Exception{KeyStore s=KeyStore.getInstance("AndroidKeyStore");s.load(null);SecretKey key=(SecretKey)s.getKey("checkin.private.v1",null);if(key==null)throw new IllegalStateException();return key;}
 static synchronized JSONObject read(Context c)throws Exception{
  if(!file(c).getBaseFile().exists())return new JSONObject();
  JSONObject box=new JSONObject(new String(file(c).readFully(),StandardCharsets.UTF_8));
  Cipher cipher=Cipher.getInstance("AES/GCM/NoPadding");cipher.init(Cipher.DECRYPT_MODE,key(),new GCMParameterSpec(128,Base64.decode(box.getString("iv"),Base64.NO_WRAP)));
  return new JSONObject(new String(cipher.doFinal(Base64.decode(box.getString("data"),Base64.NO_WRAP)),StandardCharsets.UTF_8));
 }
 static synchronized void save(Context c,JSONObject data)throws Exception{
  Cipher cipher=Cipher.getInstance("AES/GCM/NoPadding");cipher.init(Cipher.ENCRYPT_MODE,key());
  JSONObject box=new JSONObject().put("iv",Base64.encodeToString(cipher.getIV(),Base64.NO_WRAP)).put("data",Base64.encodeToString(cipher.doFinal(data.toString().getBytes(StandardCharsets.UTF_8)),Base64.NO_WRAP));
  AtomicFile target=file(c);FileOutputStream stream=null;
  try{stream=target.startWrite();byte[] bytes=box.toString().getBytes(StandardCharsets.UTF_8);stream.write(bytes);target.finishWrite(stream);stream=null;if(!java.util.Arrays.equals(bytes,target.readFully()))throw new IllegalStateException();}
  finally{if(stream!=null)target.failWrite(stream);}
 }
 static boolean reserve(JSONObject state,String day,String slot,long now)throws Exception{
  JSONArray rows=state.optJSONArray("reports");if(rows==null)rows=new JSONArray();
  int used=0;for(int i=0;i<rows.length();i++){JSONObject r=rows.getJSONObject(i);if(day.equals(r.optString("date"))){used++;if(slot.equals(r.optString("slot")))return false;}}
  if(used>=2)return false;
  rows.put(new JSONObject().put("date",day).put("slot",slot).put("at",now).put("status","running"));
  state.put("reports",rows);return true;
 }
 static synchronized boolean reserve(Context c,String day,String slot,long now)throws Exception{
  JSONObject state=read(c);if(!reserve(state,day,slot,now))return false;save(c,state);return true;
 }
 static synchronized void finish(Context c,String day,String slot,JSONObject report)throws Exception{
  JSONObject state=read(c);JSONArray rows=state.getJSONArray("reports"),kept=new JSONArray();
  for(int i=Math.max(0,rows.length()-180);i<rows.length();i++){JSONObject old=rows.getJSONObject(i);kept.put(day.equals(old.optString("date"))&&slot.equals(old.optString("slot"))?report:old);}
  state.put("reports",kept);save(c,state);
 }
}
