// Shown when copy protection is on (src/native/protect.ts) and this copy didn't come from a store.

import { ShieldAlert } from "lucide-react";
import { AUTHOR } from "@/components/SiteFooter";

export function BlockedScreen({ reason }: { reason: "sideloaded" | "repacked" }) {
  return (
    <div className="flex h-dvh flex-col items-center justify-center gap-4 bg-background px-8 text-center text-foreground">
      <ShieldAlert className="size-10 text-destructive" />
      <h1 className="font-display text-lg font-semibold">{reason === "repacked" ? "This copy has been modified" : "This copy was shared, not installed"}</h1>
      <p className="max-w-sm text-sm leading-6 text-muted-foreground">
        {reason === "repacked" ? "It was signed with a different key than the original app, so it can't run." : "PromptCut Studio runs when it is installed from an app store. Please install it from the store page to get updates."}
      </p>
      <p className="pt-4 text-[11px] text-muted-foreground">Built by {AUTHOR.name} · github.com/Motasaith</p>
    </div>
  );
}
