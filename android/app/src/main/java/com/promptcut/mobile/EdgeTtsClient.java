package com.promptcut.mobile;

import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Locale;
import java.util.TimeZone;
import java.util.UUID;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.Response;
import okhttp3.WebSocket;
import okhttp3.WebSocketListener;
import okio.ByteString;

/**
 * The Edge read-aloud protocol in plain Java (no Android classes), so it can be tested on a
 * computer. Speaks a line with a Microsoft neural voice and returns MP3 bytes plus word timings.
 */
public final class EdgeTtsClient {

    public static final class Word {
        public final double start;
        public final double end;
        public final String text;

        Word(double start, double end, String text) {
            this.start = start;
            this.end = end;
            this.text = text;
        }
    }

    public interface Callback {
        void onDone(byte[] mp3, List<Word> words);

        void onError(String message);
    }

    private static final String TRUSTED_CLIENT_TOKEN = "6A5AA1D4EAFF4E9FB37E23D68491D6F4";
    private static final String CHROMIUM_FULL_VERSION = "143.0.3650.75";
    private static final long WINDOWS_EPOCH = 11644473600L;
    /** One WordBoundary entry in an audio.metadata message. */
    private static final Pattern WORD = Pattern.compile("\"Type\"\\s*:\\s*\"WordBoundary\".*?\"Offset\"\\s*:\\s*(\\d+).*?\"Duration\"\\s*:\\s*(\\d+).*?\"Text\"\\s*:\\s*\"((?:[^\"\\\\]|\\\\.)*)\"", Pattern.DOTALL);

    private final OkHttpClient client = new OkHttpClient.Builder()
            .connectTimeout(15, TimeUnit.SECONDS)
            .readTimeout(40, TimeUnit.SECONDS)
            .build();

    /** Windows file time rounded down to five minutes, hashed with the client token. */
    static String secMsGec(long nowMillis) throws Exception {
        long seconds = nowMillis / 1000 + WINDOWS_EPOCH;
        seconds -= seconds % 300;
        String input = (seconds * 10_000_000L) + TRUSTED_CLIENT_TOKEN;
        byte[] digest = MessageDigest.getInstance("SHA-256").digest(input.getBytes(StandardCharsets.US_ASCII));
        StringBuilder hex = new StringBuilder();
        for (byte b : digest) hex.append(String.format("%02X", b));
        return hex.toString();
    }

    private static String stamp() {
        SimpleDateFormat f = new SimpleDateFormat("EEE MMM dd yyyy HH:mm:ss 'GMT+0000 (Coordinated Universal Time)'", Locale.US);
        f.setTimeZone(TimeZone.getTimeZone("UTC"));
        return f.format(new Date());
    }

    private static String escapeXml(String s) {
        return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\"", "&quot;").replace("'", "&apos;");
    }

    private static String unescapeJson(String s) {
        return s.replace("\\\"", "\"").replace("\\\\", "\\").replace("\\/", "/");
    }

    public void speak(String text, String voice, String rate, String pitch, Callback callback) {
        String url;
        try {
            url = "wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?TrustedClientToken=" + TRUSTED_CLIENT_TOKEN
                    + "&Sec-MS-GEC=" + secMsGec(System.currentTimeMillis()) + "&Sec-MS-GEC-Version=1-" + CHROMIUM_FULL_VERSION
                    + "&ConnectionId=" + UUID.randomUUID().toString().replace("-", "");
        } catch (Exception e) {
            callback.onError("Couldn't prepare the voice request");
            return;
        }
        String major = CHROMIUM_FULL_VERSION.substring(0, CHROMIUM_FULL_VERSION.indexOf('.'));
        Request request = new Request.Builder()
                .url(url)
                .header("Origin", "chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold")
                .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/" + major + ".0.0.0 Safari/537.36 Edg/" + major + ".0.0.0")
                .header("Pragma", "no-cache")
                .header("Cache-Control", "no-cache")
                .header("Accept-Language", "en-US,en;q=0.9")
                .build();

        final ByteArrayOutputStream audio = new ByteArrayOutputStream();
        final List<Word> words = new ArrayList<>();
        final AtomicBoolean finished = new AtomicBoolean(false);

        client.newWebSocket(request, new WebSocketListener() {
            @Override
            public void onOpen(WebSocket ws, Response response) {
                ws.send("X-Timestamp:" + stamp() + "\r\nContent-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n"
                        + "{\"context\":{\"synthesis\":{\"audio\":{\"metadataoptions\":{\"sentenceBoundaryEnabled\":\"false\",\"wordBoundaryEnabled\":\"true\"},\"outputFormat\":\"audio-24khz-48kbitrate-mono-mp3\"}}}}");
                String ssml = "<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='en-US'><voice name='" + voice + "'>"
                        + "<prosody pitch='" + pitch + "' rate='" + rate + "' volume='+0%'>" + escapeXml(text) + "</prosody></voice></speak>";
                ws.send("X-RequestId:" + UUID.randomUUID().toString().replace("-", "") + "\r\nContent-Type:application/ssml+xml\r\nX-Timestamp:" + stamp() + "Z\r\nPath:ssml\r\n\r\n" + ssml);
            }

            @Override
            public void onMessage(WebSocket ws, String message) {
                if (message.contains("Path:audio.metadata")) {
                    Matcher m = WORD.matcher(message);
                    while (m.find()) {
                        double start = Long.parseLong(m.group(1)) / 1e7;
                        double end = start + Long.parseLong(m.group(2)) / 1e7;
                        words.add(new Word(start, end, unescapeJson(m.group(3))));
                    }
                } else if (message.contains("Path:turn.end")) {
                    ws.close(1000, null);
                    if (!finished.compareAndSet(false, true)) return;
                    if (audio.size() == 0) callback.onError("The online voice returned no audio");
                    else callback.onDone(audio.toByteArray(), words);
                }
            }

            @Override
            public void onMessage(WebSocket ws, ByteString bytes) {
                byte[] data = bytes.toByteArray();
                if (data.length < 2) return;
                int headerLength = ((data[0] & 0xff) << 8) | (data[1] & 0xff);
                if (2 + headerLength > data.length) return;
                String headers = new String(data, 2, headerLength, StandardCharsets.US_ASCII);
                if (headers.contains("Path:audio")) audio.write(data, 2 + headerLength, data.length - 2 - headerLength);
            }

            @Override
            public void onFailure(WebSocket ws, Throwable t, Response response) {
                if (!finished.compareAndSet(false, true)) return;
                int code = response != null ? response.code() : 0;
                callback.onError(code > 0 ? "The online voice service answered " + code : "Couldn't reach the online voice service");
            }
        });
    }
}
