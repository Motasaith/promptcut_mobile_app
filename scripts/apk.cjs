// Builds the Android app and copies the result to release/ with a readable name.
//   node scripts/apk.cjs          signed release APK (needs android/keystore.properties)
//   node scripts/apk.cjs debug    debug APK for testing
//   node scripts/apk.cjs bundle   signed .aab for Google Play (same key as the APK)
// Uses JAVA_HOME and ANDROID_HOME when set, otherwise the toolchain in ../.android-toolchain.

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const kind = ["debug", "bundle"].includes(process.argv[2]) ? process.argv[2] : "release";
const toolchain = path.resolve(root, "..", ".android-toolchain");
const env = { ...process.env };
if (!env.JAVA_HOME && fs.existsSync(path.join(toolchain, "jdk"))) env.JAVA_HOME = path.join(toolchain, "jdk");
if (!env.ANDROID_HOME && fs.existsSync(path.join(toolchain, "sdk"))) env.ANDROID_HOME = path.join(toolchain, "sdk");
if (!env.JAVA_HOME) throw new Error("Set JAVA_HOME to a JDK 21 install (or install Android Studio, which bundles one).");
if (kind !== "debug" && !fs.existsSync(path.join(root, "android", "keystore.properties"))) {
  throw new Error("android/keystore.properties is missing, so the release build can't be signed. See STATUS.md.");
}

const run = (cmd, cwd = root) => execSync(cmd, { cwd, env, stdio: "inherit" });
run("npx vite build");
run("npx cap sync android");
const gradlew = JSON.stringify(path.join(root, "android", process.platform === "win32" ? "gradlew.bat" : "gradlew"));
const task = { debug: "assembleDebug", release: "assembleRelease", bundle: "bundleRelease" }[kind];
run(`${gradlew} ${task} --console=plain`, path.join(root, "android"));

const gradle = fs.readFileSync(path.join(root, "android", "app", "build.gradle"), "utf8");
const version = (gradle.match(/versionName\s+"([^"]+)"/) || [])[1] || "0";
const outputs = path.join(root, "android", "app", "build", "outputs");
const built = kind === "bundle" ? path.join(outputs, "bundle", "release", "app-release.aab") : path.join(outputs, "apk", kind, `app-${kind}.apk`);
const out = path.join(root, "release", `PromptCut-Studio-${version}${kind === "debug" ? "-debug" : ""}.${kind === "bundle" ? "aab" : "apk"}`);
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.copyFileSync(built, out);
console.log(`${kind === "bundle" ? "Bundle" : "APK"} ready: ${path.relative(root, out)} (${(fs.statSync(out).size / 1048576).toFixed(1)} MB)`);
