# PromptCut Studio for Android

<p align="center">
  <img src="store/icon-512.png" width="128" height="128" alt="PromptCut Studio Icon" />
</p>

The **Stickman Studio** video editor (by Abdul Rauf Azhar, [GitHub](https://github.com/Motasaith/StickMan)) packaged as a native Android application. It is not a website in a wrapper: the whole editor, its storage, and its server run inside the app, so it opens and edits completely offline without internet access.

---

## Key Features

- **Offline-First Video Editing**: Full timeline, stickmen and poses, text, stickers, illustration library, fonts, slides, effects, undo, and redo.
- **Media Management**: Import local photos, videos, and audio directly from the device. Save, duplicate, restore, and rename projects in private app storage.
- **Export & Sharing**: Render to MP4 and share across Android share targets (WhatsApp, Drive, Gallery, etc.).
- **Voice Synthesis**:
  - Offline narration using the phone's native Text-to-Speech engine (`DeviceVoice`).
  - Online Microsoft neural voices (`EdgeVoice`) when connected to the internet.
- **AI-Powered Tools (Optional)**:
  - AI video generator, AI Director edits, scene reviews, and YouTube metadata packs using your own API keys.
  - Stock media and illustration integration via Pexels and Pollinations.
- **Native Android Integration**: Built with Capacitor, custom Java native plugins, and Android security/intent integration.

---

## Architecture Overview

- **Embedded Runtime**: The studio server (Hono) runs entirely inside the mobile app. Calls to `/api/...` are intercepted locally (`src/server/intercept.ts`).
- **Native Shims**: Desktop-only dependencies (ffmpeg, local heavy model inference) are replaced with mobile-friendly equivalents in `src/server/shims/`.
- **Native Plugins**: Custom Java plugins in `android/app/src/main/java/com/promptcut/mobile/`:
  - `EdgeVoice`: High-quality neural voice synthesis.
  - `DeviceVoice`: Native offline Android TTS.
  - `InstallGuard`: Package integrity and signature verification.

---

## Development & Build Setup

### Prerequisites

- **Node.js**: v20+
- **Android SDK & JDK**: JDK 21 and Android SDK configured via `ANDROID_HOME` / `JAVA_HOME`.
- **Sibling Workspace**: `vite.config.ts` references the desktop studio codebase located in `../StickMan`.

### Quick Commands

```bash
# Install dependencies
npm install

# Type check
npm run check

# Development server
npm run dev

# Build web assets and sync to Android
npm run cap:build

# Build Debug APK (outputs to release/PromptCut-Studio-<version>-debug.apk)
npm run apk:debug

# Build Release APK (signed)
npm run apk:release

# Build Android App Bundle (for Google Play)
npm run aab:release
```

---

## Documentation

- **[STATUS.md](STATUS.md)**: Detailed project status, capabilities, and feature matrix.
- **[PUBLISHING.md](PUBLISHING.md)**: Store submission, release preparation, and distribution guide.
- **[ATTRIBUTION.md](ATTRIBUTION.md)**: Attribution notices, open-source libraries, and graphics credits.
- **[LICENSE](LICENSE)**: GNU Affero General Public License v3.0 (AGPL-3.0-or-later).

---

## License & Attribution

This project is licensed under the **GNU Affero General Public License v3.0** (`AGPL-3.0-or-later`).  
Built by **Abdul Rauf Azhar** ([@Motasaith](https://github.com/Motasaith)).
