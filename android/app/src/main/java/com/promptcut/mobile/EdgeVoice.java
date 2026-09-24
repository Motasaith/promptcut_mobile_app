package com.promptcut.mobile;

import android.util.Base64;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.List;

/**
 * Microsoft Edge's online neural voices, the same ones the desktop studio uses through
 * node-edge-tts. The service only accepts connections that look like Edge's read-aloud feature,
 * which a web page can't make, so the connection is opened natively (see EdgeTtsClient).
 * Returns MP3 audio (base64) and the time of every spoken word, for captions.
 */
@CapacitorPlugin(name = "EdgeVoice")
public class EdgeVoice extends Plugin {

    private final EdgeTtsClient client = new EdgeTtsClient();

    @PluginMethod
    public void speak(PluginCall call) {
        String text = call.getString("text", "");
        if (text == null || text.trim().isEmpty()) {
            call.reject("Nothing to say");
            return;
        }
        client.speak(text, call.getString("voice", "en-US-AndrewMultilingualNeural"), call.getString("rate", "+0%"), call.getString("pitch", "+0Hz"), new EdgeTtsClient.Callback() {
            @Override
            public void onDone(byte[] mp3, List<EdgeTtsClient.Word> words) {
                JSArray list = new JSArray();
                for (EdgeTtsClient.Word w : words) {
                    JSObject o = new JSObject();
                    o.put("start", w.start);
                    o.put("end", w.end);
                    o.put("text", w.text);
                    list.put(o);
                }
                JSObject out = new JSObject();
                out.put("audio", Base64.encodeToString(mp3, Base64.NO_WRAP));
                out.put("words", list);
                call.resolve(out);
            }

            @Override
            public void onError(String message) {
                call.reject(message);
            }
        });
    }
}
