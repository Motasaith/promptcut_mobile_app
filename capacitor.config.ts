import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.promptcut.mobile",
  appName: "PromptCut Studio",
  webDir: "dist",
  server: {
    androidScheme: "https",
  },
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
