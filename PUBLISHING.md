# Publishing PromptCut Studio

## What to upload

| Store | File | Notes |
| --- | --- | --- |
| APKPure, Uptodown, APKMirror-style sites, your own website | `release/PromptCut-Studio-<version>.apk` | Signed with your release key. |
| Amazon Appstore, Samsung Galaxy Store, Huawei AppGallery | the same `.apk` | Each has its own free developer account. |
| Google Play (later) | `release/PromptCut-Studio-<version>.aab` | Play needs the bundle, not the APK. Same key. |

Store icon: `store/icon-512.png`. Screenshots: take them on a phone (Home, the editor, AI video,
Settings). Most stores want at least 2.

Never upload the debug APK: it is not signed with your key, so updates would not install over it.

## APKPure (and similar sites)

1. Create a developer account on the store's developer or "submit app" page.
2. Upload the release APK. The store reads the package name (`com.promptcut.mobile`), version and
   signature from it. Keep the same key forever: stores reject updates signed differently.
3. Fill in the listing (text below), the icon, the screenshots and a privacy note.
4. For an update: raise `versionCode` in `android/app/build.gradle`, run `npm run apk:release`,
   upload the new APK on the same listing.

Tell users to allow "Install unknown apps" for the store app or browser they use. That's normal
for any app outside Google Play.

## Listing text

**Name:** PromptCut Studio

**Short description:** Make stickman and faceless videos on your phone, with an AI video maker.

**Full description:**

PromptCut Studio is a video editor for stickman animations, explainers and faceless YouTube
videos. The editor works without internet, and it has an AI video maker for when you are online.

- Timeline editor with stick figures, poses, text, stickers, illustrations and slides
- Works offline: edit, save and export videos with no connection
- AI video maker: pick a topic and length, and it writes the script scene by scene, finds
  footage, adds a voice and captions
- Natural voices online, and your phone's own voice offline
- YouTube pack: thumbnail, description and tags
- Export to MP4 and share straight to any app
- Bring your own AI and stock-footage keys; nothing is sent to our servers

Free and open source (AGPL-3.0). Built by Abdul Rauf Azhar.
Source code: https://github.com/Motasaith/StickMan

**Category:** Video Players and Editors

**Privacy note:** The app has no accounts and no analytics. Projects stay on the phone. When the
user turns on AI features, their text is sent to the AI and stock-footage services whose keys the
user enters, and nowhere else.

## License duties when you publish

The app is built from AGPL-3.0-or-later code, so:

- Keep `LICENSE`, `NOTICE`, `ATTRIBUTION.md` and the in-app "Built by Abdul Rauf Azhar" credit.
- Put a link to the source code in the store listing (the listing text above already does).
  If the mobile code lives outside the StickMan repository, publish it too and link it.
