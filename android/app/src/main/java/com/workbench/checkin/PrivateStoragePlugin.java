package com.workbench.checkin;

import android.security.keystore.KeyGenParameterSpec;
import android.content.Context;
import android.security.keystore.KeyProperties;
import android.util.AtomicFile;
import android.util.Base64;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;
import org.json.JSONObject;

/** App-private ciphertext; keys never leave AndroidKeyStore. No cloud backup. */
@CapacitorPlugin(name = "PrivateStorage")
public class PrivateStoragePlugin extends Plugin {
    private static final String ALIAS = "checkin.private.v1";
    public static JSONObject readValues(Context context) throws Exception {
        AtomicFile file = new AtomicFile(new File(context.getNoBackupFilesDir(), "workbench.enc"));
        if (!file.getBaseFile().exists()) return new JSONObject();
        JSONObject box = new JSONObject(new String(file.readFully(), StandardCharsets.UTF_8));
        KeyStore store = KeyStore.getInstance("AndroidKeyStore"); store.load(null);
        SecretKey key = (SecretKey) store.getKey(ALIAS, null);
        if (key == null) throw new IllegalStateException("Key unavailable");
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.DECRYPT_MODE, key, new GCMParameterSpec(128, Base64.decode(box.getString("iv"), Base64.NO_WRAP)));
        return new JSONObject(new String(cipher.doFinal(Base64.decode(box.getString("data"), Base64.NO_WRAP)), StandardCharsets.UTF_8));
    }

    private synchronized SecretKey key() throws Exception {
        KeyStore store = KeyStore.getInstance("AndroidKeyStore");
        store.load(null);
        if (store.containsAlias(ALIAS)) return (SecretKey) store.getKey(ALIAS, null);
        KeyGenerator generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
        generator.init(new KeyGenParameterSpec.Builder(ALIAS,
                KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).build());
        return generator.generateKey();
    }
    private AtomicFile file() {
        return new AtomicFile(new File(getContext().getNoBackupFilesDir(), "workbench.enc"));
    }
    @PluginMethod
    public synchronized void load(PluginCall call) {
        try {
            if (!file().getBaseFile().exists()) {
                JSObject result = new JSObject(); result.put("values", new JSObject());
                call.resolve(result); return;
            }
            JSONObject envelope = new JSONObject(new String(file().readFully(), StandardCharsets.UTF_8));
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, key(), new GCMParameterSpec(128,
                    Base64.decode(envelope.getString("iv"), Base64.NO_WRAP)));
            String plaintext = new String(cipher.doFinal(Base64.decode(
                    envelope.getString("data"), Base64.NO_WRAP)), StandardCharsets.UTF_8);
            JSObject result = new JSObject(); result.put("values", new JSObject(plaintext));
            call.resolve(result);
        } catch (Exception e) {
            call.reject("加密数据无法读取，请保留原应用并检查设备解锁状态");
        }
    }
    @PluginMethod
    public synchronized void save(PluginCall call) {
        FileOutputStream stream = null;
        try {
            JSObject values = call.getObject("values");
            if (values == null) throw new IllegalArgumentException();
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE, key());
            byte[] encrypted = cipher.doFinal(values.toString().getBytes(StandardCharsets.UTF_8));
            JSONObject envelope = new JSONObject();
            envelope.put("iv", Base64.encodeToString(cipher.getIV(), Base64.NO_WRAP));
            envelope.put("data", Base64.encodeToString(encrypted, Base64.NO_WRAP));
            AtomicFile target = file();
            stream = target.startWrite();
            stream.write(envelope.toString().getBytes(StandardCharsets.UTF_8));
            target.finishWrite(stream); stream = null;
            call.resolve();
        } catch (Exception e) {
            if (stream != null) file().failWrite(stream);
            call.reject("加密保存失败，请勿退出应用，先导出备份");
        }
    }
}
