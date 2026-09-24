package com.promptcut.mobile;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Android's default user agent ("Dalvik/...") is refused by some AI providers' firewalls
        // (ollama.com answers 403), so native requests without their own user agent name the app.
        System.setProperty("http.agent", "PromptCutStudio/" + BuildConfig.VERSION_NAME + " (Android)");
        registerPlugin(InstallGuard.class);
        registerPlugin(EdgeVoice.class);
        registerPlugin(DeviceVoice.class);
        super.onCreate(savedInstanceState);
    }
}
