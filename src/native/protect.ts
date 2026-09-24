// Optional copy protection.
//
// What this can do: refuse to run a copy that was passed around with Zapya, ShareIt, Bluetooth or
// a file manager, and refuse a repacked APK signed with someone else's key.
// What it cannot do: stop anyone from extracting the APK in the first place, or from patching
// this check out of a modified build. Treat it as a speed bump for casual sharing, not security.
// Real enforcement needs Google Play's Integrity API and a server that verifies its verdict.

import { Capacitor, registerPlugin } from "@capacitor/core";

/**
 * Only allow installs from the stores listed below. Keep this off while the app is shared as an APK
 * (APKPure and other unofficial stores count as side-loading, so everyone would be blocked).
 */
export const REQUIRE_TRUSTED_INSTALL: boolean = false;

/**
 * SHA-256 of your release signing certificate, uppercase hex, no colons. A release build signed
 * with any other key (a repacked copy) shows the block screen. Leave empty to skip the check. Get it with:
 *   keytool -list -v -keystore my-release-key.jks -alias my-alias
 * or read it from the About screen on a device where you installed your own release build.
 */
export const EXPECTED_SIGNATURE: string = "3739C0A524CEDA1139ADF4CF6F9EF982502917A7C6E4E335C4E62E0841B42875";

/** Stores that count as a real install. */
const TRUSTED_INSTALLERS = [
  "com.android.vending", // Google Play
  "com.google.android.feedback", // Play (older devices)
  "com.amazon.venezia", // Amazon Appstore
  "com.huawei.appmarket", // Huawei AppGallery
];

export interface InstallInfo {
  packageName: string;
  installer: string;
  debuggable: boolean;
  signature: string;
}

const InstallGuard = registerPlugin<{ check(): Promise<InstallInfo> }>("InstallGuard");

export interface GuardResult {
  ok: boolean;
  /** Why it was refused, for the block screen. */
  reason?: "sideloaded" | "repacked";
  info?: InstallInfo;
}

/** Check where this copy came from. Always ok on the web, in debug builds, or when turned off. */
export async function checkInstall(): Promise<GuardResult> {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "android") return { ok: true };
  let info: InstallInfo;
  try {
    info = await InstallGuard.check();
  } catch {
    // The plugin is missing (older build): don't lock anyone out.
    return { ok: true };
  }
  if (info.debuggable) return { ok: true, info };
  if (EXPECTED_SIGNATURE && info.signature && info.signature !== EXPECTED_SIGNATURE.toUpperCase()) return { ok: false, reason: "repacked", info };
  if (REQUIRE_TRUSTED_INSTALL && !TRUSTED_INSTALLERS.includes(info.installer)) return { ok: false, reason: "sideloaded", info };
  return { ok: true, info };
}
