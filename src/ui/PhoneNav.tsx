// The tab bar at the bottom of every screen except the editor.

import { NavLink } from "react-router";
import { CircleQuestionMark, Home, Mic2, Settings, Wand2 } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { to: "/", label: "Home", icon: Home, end: true },
  { to: "/create", label: "AI video", icon: Wand2 },
  { to: "/voices", label: "Voices", icon: Mic2 },
  { to: "/help", label: "Help", icon: CircleQuestionMark },
  { to: "/settings", label: "Settings", icon: Settings },
];

export function PhoneNav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-line bg-panel/95 backdrop-blur" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
      {TABS.map((t) => (
        <NavLink
          key={t.to}
          to={t.to}
          end={t.end}
          className={({ isActive }) => cn("flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px]", isActive ? "text-primary" : "text-muted-foreground")}
        >
          <t.icon className="size-5" />
          {t.label}
        </NavLink>
      ))}
    </nav>
  );
}
