// Whether the phone has internet right now, following changes as they happen.

import { useEffect, useState } from "react";
import { Network } from "@capacitor/network";

export function useOnline(): boolean {
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    let handle: { remove: () => Promise<void> } | null = null;
    void Network.getStatus()
      .then((s) => setOnline(s.connected))
      .catch(() => {});
    void Network.addListener("networkStatusChange", (s) => setOnline(s.connected))
      .then((h) => (handle = h))
      .catch(() => {});
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => {
      void handle?.remove();
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  }, []);
  return online;
}
