"use client";

import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

/**
 * Registers the service worker and optionally surfaces an install affordance.
 * Renders nothing until beforeinstallprompt fires (Chrome/Edge).
 */
export function PwaRegister({
  onInstallAvailable,
}: {
  onInstallAvailable?: (install: (() => Promise<void>) | null) => void;
} = {}) {
  const [, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    const register = () => {
      void navigator.serviceWorker.register("/sw.js").catch(() => {
        // Ignore — private mode / unsupported
      });
    };

    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });

    const onBip = (e: Event) => {
      e.preventDefault();
      const ev = e as BeforeInstallPromptEvent;
      setDeferred(ev);
      onInstallAvailable?.(async () => {
        await ev.prompt();
        await ev.userChoice;
        setDeferred(null);
        onInstallAvailable?.(null);
      });
    };

    window.addEventListener("beforeinstallprompt", onBip);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBip);
    };
  }, [onInstallAvailable]);

  return null;
}
