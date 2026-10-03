import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.promptcut.mobile",
  appName: "PromptCut Studio",
  webDir: "dist",
  server: {
    androidScheme: "https",
  },
  // Diagnostic builds only (PROMPTCUT_DIAGNOSTIC=1): Chrome can inspect the web view and the
  // console reaches logcat. Never publish a build made this way.
  android: process.env.PROMPTCUT_DIAGNOSTIC === "1" ? { webContentsDebuggingEnabled: true, loggingBehavior: "production" } : undefined,
  plugins: {
    // Calls to AI providers and stock libraries go through Android's own networking, so they
    // aren't limited by the web view's cross-site rules. The app's own files stay local.
    CapacitorHttp: {
      enabled: true,
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#1b1d18",
    },
  },
};

export default config;
