# PromptCut Studio for Android

The Stickman Studio video editor (by Abdul Rauf Azhar, <https://github.com/Motasaith/StickMan>)
packaged as a real Android app. It is not a website in a wrapper: the whole editor, its storage
and its server run inside the app, so it opens and edits with no internet.

License: AGPL-3.0-or-later (see `LICENSE`, `NOTICE`, `ATTRIBUTION.md`). Anyone you give the APK
to must be able to get the source code, so keep the source public (for example on GitHub) and
link it from the store listing.

Checked on 23 September 2026.

## How it is built

- The app has no copy of the studio's code. `vite.config.ts` imports it straight from
  `../StickMan/src` and `../StickMan/server`, so every fix made to the desktop studio reaches the
  phone on the next build. **`D:\try\StickMan` must sit next to this folder.**
- The studio's server (Hono) runs inside the app. Calls to `/api/...` never leave the phone
  (`src/server/intercept.ts`). Desktop-only parts (ffmpeg, local voice models, Node file access)
  are replaced by phone versions in `src/server/shims/`.
- Projects and media are saved in the app's private storage (`studio/` in the app's data folder).
- Native Java plugins in `android/app/src/main/java/com/promptcut/mobile/`:
  `EdgeVoice` (Microsoft neural voices), `DeviceVoice` (the phone's own offline voice) and
  `InstallGuard` (copy protection).
- AI and stock-library requests go through Android's own networking (CapacitorHttp).

## What works

**With no internet**

- The full editor: timeline, stickmen and poses, text, stickers, the illustration library, fonts,
  slides, effects, undo and redo.
- Importing your own photos, videos and audio from the phone.
- Saving projects on the phone, and renaming, duplicating, deleting and restoring versions.
- Exporting a video to an MP4 file and sharing it (WhatsApp, Drive, Gallery and so on).
- The sample video, and the help centre articles.
- Narration with the phone's built-in voice (used on its own when the online voices can't be reached).

**With internet and the user's own keys** (entered in the app's Settings screen, stored only on the phone)

- AI video generator (topic, length, script scene by scene, footage, voice, captions), batch mode.
- AI Director edits, post-build scene review, help assistant, YouTube pack (thumbnail,
  description, tags): need an AI key (`LLM_*` settings).
- Stock photos and footage: Pexels key. AI illustrations: Pollinations key.
- Microsoft neural voices: internet only, no key.

**Only in the desktop studio**

- Voice cloning, blended voices and the local Kokoro voices (they need a large model and Node).
- "My voice" transcription (Whisper).
- GIF, MP3 and cover-image conversions on export (they need ffmpeg). The phone exports MP4.

## Not yet tested on a real phone

Everything above was verified in a phone-sized browser build of the same code, and the native Java
voice code was tested against Microsoft's service from a computer. These still need a check on an
actual device:

- The phone's own voice (DeviceVoice), the share sheet and saving to Documents.
- Export speed and format. If the phone's WebView lacks the video encoder, the app falls back to
  a WebM file.
- A full AI video build on the phone.

## Build it

Requirements: Node 20+, and JDK 21 plus the Android SDK. `scripts/apk.cjs` uses `JAVA_HOME` and
`ANDROID_HOME` when set, otherwise `D:\try\.android-toolchain` (the JDK and SDK downloaded for
this project).

```
npm install              (also run it once in ../StickMan)
npm run check            type check
npm run apk:debug        release/PromptCut-Studio-<version>-debug.apk, for testing
npm run apk:release      release/PromptCut-Studio-<version>.apk, signed, for APK stores
npm run aab:release      release/PromptCut-Studio-<version>.aab, signed, for Google Play later
```

To try the app in a browser at phone size: `npm run build && npx vite preview --port 5191`, then
`node scripts/phone-ui.mjs` runs the automated phone check.

## Your signing key: back it up now

`android/keystore.properties` and `android/keystore/promptcut-release.jks` are the app's identity.
Phones only accept an update signed with the same key, so if you lose them, you can never update
the app again; people would have to uninstall it and lose their projects. Copy both files to a
password manager or a private backup (not a public repository). They are already excluded from git.

Certificate SHA-256: `3739C0A524CEDA1139ADF4CF6F9EF982502917A7C6E4E335C4E62E0841B42875`

## Publishing an update

1. In `android/app/build.gradle`, raise `versionCode` by one (1, 2, 3 ...) and set `versionName`
   (1.0.1 ...).
2. `npm run apk:release`.
3. Upload the new APK to each store. See `PUBLISHING.md`.

## Copy protection

`src/native/protect.ts`:

- A release build signed with a different key (someone repacked your APK) shows a block screen.
  This is on.
- `REQUIRE_TRUSTED_INSTALL` blocks copies that weren't installed from Google Play, Amazon or
  Huawei. It is **off**, because APKPure and other APK stores count as side-loading and every
  user would be blocked. Turn it on only once the app ships from Play.
- No check can stop someone from sending the APK itself with Zapya or ShareIt while you
  distribute an APK. That is only enforceable through Google Play with its Integrity API.

## Credits

The home screen footer and the Legal > Credits page show "Built by Abdul Rauf Azhar" with the
GitHub link, as the license requires.
