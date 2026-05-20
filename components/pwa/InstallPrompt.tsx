"use client";

import { useEffect, useState } from "react";

const DISMISS_KEY = "skybook-install-dismissed";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/**
 * Captures `beforeinstallprompt` on first-time mobile visitors and shows a
 * small banner. Dismissal is sticky via localStorage so we don't nag.
 */
export function InstallPrompt() {
  const [evt, setEvt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem(DISMISS_KEY)) return;

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEvt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (!evt) return null;

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, "1");
    setEvt(null);
  };
  const install = async () => {
    await evt.prompt();
    await evt.userChoice;
    dismiss();
  };

  return (
    <div className="fixed inset-x-3 bottom-3 z-40 flex items-center gap-3 rounded-xl bg-foreground p-3 text-white shadow-lg sm:left-auto sm:right-4 sm:max-w-sm">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-600 text-lg">
        ✈
      </span>
      <div className="flex-1 text-sm">
        <p className="font-semibold">Install SkyBook</p>
        <p className="text-xs opacity-80">Add to your home screen for quick access.</p>
      </div>
      <button
        onClick={install}
        className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium"
      >
        Install
      </button>
      <button
        onClick={dismiss}
        aria-label="Dismiss"
        className="text-lg opacity-70 hover:opacity-100"
      >
        ×
      </button>
    </div>
  );
}
