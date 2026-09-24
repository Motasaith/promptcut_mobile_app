// PromptCut Studio for Android: the Stickman Studio app running on the phone.
// Copyright (c) 2026 Abdul Rauf Azhar <https://github.com/Motasaith>
// Source: https://github.com/Motasaith/StickMan
// SPDX-License-Identifier: AGPL-3.0-or-later
// Keep this notice: AGPL-3.0 sections 5(d) and 7(b), see ATTRIBUTION.md in the studio.

import "./polyfills";
import { StrictMode, lazy, Suspense, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes, useLocation, useNavigate } from "react-router";
import { Loader2 } from "lucide-react";
import { App as CapApp } from "@capacitor/app";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { setPlatform } from "@/platform";
import { loadFonts } from "@/fonts";
import { installDebugHandle } from "@/debug";
import "@/index.css";
import "./phone.css";
import { prepareFiles } from "./storage/files";
import { loadSettings } from "./server/shims/settings";
import { installInAppServer } from "./server/intercept";
import { saveAndShare } from "./native/share";
import { checkInstall, type GuardResult } from "./native/protect";
import { PhoneHome } from "./ui/PhoneHome";
import { PhoneVoices } from "./ui/PhoneVoices";
import { PhoneNav } from "./ui/PhoneNav";
import { PhoneWorkspace } from "./ui/PhoneWorkspace";
import { BlockedScreen } from "./ui/BlockedScreen";

const Editor = lazy(() => import("@/pages/Editor"));
const Create = lazy(() => import("@/pages/Create"));
const Batch = lazy(() => import("@/pages/Batch"));
const Help = lazy(() => import("@/pages/Help"));
const Settings = lazy(() => import("@/pages/Settings"));
const Legal = lazy(() => import("@/pages/Legal"));

function Loading() {
  return (
    <div className="flex h-dvh items-center justify-center bg-background">
      <Loader2 className="size-6 animate-spin text-muted-foreground" />
    </div>
  );
}

/** Android's back button: back through the app, and out of it from the home screen. */
function BackButton() {
  const navigate = useNavigate();
  const location = useLocation();
  useEffect(() => {
    const sub = CapApp.addListener("backButton", () => {
      if (location.pathname === "/") void CapApp.exitApp();
      else if (location.pathname.startsWith("/editor/")) navigate("/");
      else navigate(-1);
    });
    return () => {
      void sub.then((h) => h.remove());
    };
  }, [location.pathname, navigate]);
  return null;
}

function Shell() {
  const location = useLocation();
  const inEditor = location.pathname.startsWith("/editor/");
  return (
    <>
      <BackButton />
      <div className={inEditor ? undefined : "pb-16"}>
      <Suspense fallback={<Loading />}>
        <Routes>
          <Route path="/" element={<PhoneHome />} />
          <Route path="/create" element={<Create />} />
          <Route path="/batch" element={<Batch />} />
          <Route path="/voices" element={<PhoneVoices />} />
          <Route path="/help" element={<Help />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/legal/:page" element={<Legal />} />
          <Route
            path="/editor/:projectId"
            element={
              <ErrorBoundary>
                <Editor layout={PhoneWorkspace} />
              </ErrorBoundary>
            }
          />
          <Route path="*" element={<PhoneHome />} />
        </Routes>
      </Suspense>
      </div>
      {!inEditor && <PhoneNav />}
    </>
  );
}

function Guarded() {
  const [guard, setGuard] = useState<GuardResult | null>(null);
  useEffect(() => {
    void checkInstall().then(setGuard);
  }, []);
  if (guard && !guard.ok) return <BlockedScreen reason={guard.reason ?? "sideloaded"} />;
  return <Shell />;
}

async function boot() {
  await prepareFiles();
  await loadSettings();
  installInAppServer();
  setPlatform({
    kind: "mobile",
    saveFile: saveAndShare,
    has: () => false,
  });
  void loadFonts();
  if (import.meta.env.DEV || new URLSearchParams(location.search).has("debug")) installDebugHandle();
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <TooltipProvider delayDuration={400}>
        <BrowserRouter>
          <Guarded />
        </BrowserRouter>
        <Toaster position="top-center" />
      </TooltipProvider>
    </StrictMode>
  );
}

void boot();
