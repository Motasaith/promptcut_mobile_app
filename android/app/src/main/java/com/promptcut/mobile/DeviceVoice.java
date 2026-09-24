package com.promptcut.mobile;

import android.os.Bundle;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;
import android.speech.tts.Voice;
import android.util.Base64;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileInputStream;
import java.io.ByteArrayOutputStream;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * The phone's own text to speech, which works with no internet: a line is written to a WAV file
 * with Android's TextToSpeech engine and returned as base64. Used when the online voices can't
 * be reached, so a video can still be narrated offline.
 */
@CapacitorPlugin(name = "DeviceVoice")
public class DeviceVoice extends Plugin {

    private TextToSpeech tts;
    private volatile boolean ready = false;
    private volatile boolean failed = false;
    private final List<Runnable> waiting = new ArrayList<>();
    private final Map<String, PluginCall> calls = new ConcurrentHashMap<>();
    private final Map<String, File> files = new ConcurrentHashMap<>();

    @Override
    public void load() {
        tts = new TextToSpeech(getContext(), status -> {
            synchronized (waiting) {
                ready = status == TextToSpeech.SUCCESS;
                failed = !ready;
                for (Runnable r : waiting) r.run();
                waiting.clear();
            }
        });
        tts.setOnUtteranceProgressListener(new UtteranceProgressListener() {
            @Override
            public void onStart(String id) {}

            @Override
            public void onDone(String id) {
                PluginCall call = calls.remove(id);
                File file = files.remove(id);
                if (call == null || file == null) return;
                try (FileInputStream in = new FileInputStream(file)) {
                    ByteArrayOutputStream out = new ByteArrayOutputStream();
                    byte[] buf = new byte[64 * 1024];
                    int n;
                    while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
                    JSObject result = new JSObject();
                    result.put("audio", Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP));
                    call.resolve(result);
                } catch (Exception e) {
                    call.reject("Couldn't read the spoken line");
                } finally {
                    //noinspection ResultOfMethodCallIgnored
                    file.delete();
                }
            }

            @Override
            @SuppressWarnings("deprecation")
            public void onError(String id) {
                PluginCall call = calls.remove(id);
                File file = files.remove(id);
                if (file != null) //noinspection ResultOfMethodCallIgnored
                    file.delete();
                if (call != null) call.reject("The phone's voice couldn't speak that line");
            }
        });
    }

    @Override
    protected void handleOnDestroy() {
        if (tts != null) tts.shutdown();
    }

    /** Run once the engine has started (it starts in the background). */
    private void whenReady(PluginCall call, Runnable run) {
        synchronized (waiting) {
            if (ready) run.run();
            else if (failed) call.reject("This phone has no text-to-speech engine. Install Google Speech Services from the Play Store.");
            else waiting.add(() -> {
                if (ready) run.run();
                else call.reject("This phone has no text-to-speech engine. Install Google Speech Services from the Play Store.");
            });
        }
    }

    /** The best installed voice for a language: offline first, then the country, then any. */
    private Voice pick(Locale want) {
        Voice best = null;
        int bestScore = -1;
        try {
            for (Voice v : tts.getVoices()) {
                Locale l = v.getLocale();
                if (!l.getLanguage().equals(want.getLanguage())) continue;
                int score = 0;
                if (!v.isNetworkConnectionRequired()) score += 4;
                if (l.getCountry().equalsIgnoreCase(want.getCountry())) score += 2;
                if (v.getQuality() >= Voice.QUALITY_HIGH) score += 1;
                if (score > bestScore) {
                    best = v;
                    bestScore = score;
                }
            }
        } catch (Exception ignored) {
            // Some engines don't list voices; the language default is used then.
        }
        return best;
    }

    @PluginMethod
    public void synthesize(PluginCall call) {
        String text = call.getString("text", "");
        String language = call.getString("language", "en-US");
        boolean male = Boolean.TRUE.equals(call.getBoolean("male", false));
        float rate = call.getFloat("rate", 1f);
        float pitch = call.getFloat("pitch", 1f);
        if (text == null || text.trim().isEmpty()) {
            call.reject("Nothing to say");
            return;
        }
        whenReady(call, () -> {
            Locale locale = Locale.forLanguageTag(language);
            Voice voice = pick(locale);
            if (voice != null) tts.setVoice(voice);
            else tts.setLanguage(locale);
            tts.setSpeechRate(rate);
            // Most phones have one voice per language: a slightly lower pitch reads as a man.
            tts.setPitch(male ? pitch * 0.88f : pitch);
            String id = UUID.randomUUID().toString();
            File file = new File(getContext().getCacheDir(), "tts_" + id + ".wav");
            calls.put(id, call);
            files.put(id, file);
            Bundle params = new Bundle();
            params.putString(TextToSpeech.Engine.KEY_PARAM_UTTERANCE_ID, id);
            int result = tts.synthesizeToFile(text, params, file, id);
            if (result != TextToSpeech.SUCCESS) {
                calls.remove(id);
                files.remove(id);
                call.reject("The phone's voice couldn't start");
            }
        });
    }

    @PluginMethod
    public void voices(PluginCall call) {
        whenReady(call, () -> {
            JSArray list = new JSArray();
            try {
                for (Voice v : tts.getVoices()) {
                    JSObject o = new JSObject();
                    o.put("name", v.getName());
                    o.put("language", v.getLocale().toLanguageTag());
                    o.put("offline", !v.isNetworkConnectionRequired());
                    list.put(o);
                }
            } catch (Exception ignored) {
                // An engine that doesn't list voices returns an empty list.
            }
            JSObject out = new JSObject();
            out.put("voices", list);
            call.resolve(out);
        });
    }
}
