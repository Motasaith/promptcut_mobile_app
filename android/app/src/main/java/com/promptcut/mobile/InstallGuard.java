package com.promptcut.mobile;

import android.content.pm.ApplicationInfo;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.pm.Signature;
import android.content.pm.SigningInfo;
import android.os.Build;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.security.MessageDigest;

/**
 * Tells the web layer where this copy of the app came from and which key signed it.
 *
 * A copied APK (shared with Zapya, ShareIt, Bluetooth, a file manager) has no Play Store installer
 * name, and a repacked one is signed with a different key. This only reports the facts; the app
 * decides what to do with them. It cannot stop a determined person from extracting the APK.
 */
@CapacitorPlugin(name = "InstallGuard")
public class InstallGuard extends Plugin {

    @PluginMethod
    public void check(PluginCall call) {
        JSObject out = new JSObject();
        PackageManager pm = getContext().getPackageManager();
        String pkg = getContext().getPackageName();

        String installer = null;
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                installer = pm.getInstallSourceInfo(pkg).getInstallingPackageName();
            } else {
                installer = pm.getInstallerPackageName(pkg);
            }
        } catch (Exception ignored) {
            // A missing installer name is itself the answer: the app was side-loaded.
        }

        boolean debuggable = (getContext().getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0;

        out.put("packageName", pkg);
        out.put("installer", installer == null ? "" : installer);
        out.put("debuggable", debuggable);
        out.put("signature", signingDigest(pm, pkg));
        call.resolve(out);
    }

    /** SHA-256 of the signing certificate, uppercase hex, so a repacked build can be spotted. */
    private String signingDigest(PackageManager pm, String pkg) {
        try {
            Signature[] signatures;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                PackageInfo info = pm.getPackageInfo(pkg, PackageManager.GET_SIGNING_CERTIFICATES);
                SigningInfo signing = info.signingInfo;
                if (signing == null) return "";
                signatures = signing.hasMultipleSigners() ? signing.getApkContentsSigners() : signing.getSigningCertificateHistory();
            } else {
                @SuppressWarnings("deprecation")
                PackageInfo info = pm.getPackageInfo(pkg, PackageManager.GET_SIGNATURES);
                @SuppressWarnings("deprecation")
                Signature[] legacy = info.signatures;
                signatures = legacy;
            }
            if (signatures == null || signatures.length == 0) return "";
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] digest = md.digest(signatures[0].toByteArray());
            StringBuilder hex = new StringBuilder(digest.length * 2);
            for (byte b : digest) hex.append(String.format("%02X", b));
            return hex.toString();
        } catch (Exception e) {
            return "";
        }
    }
}
