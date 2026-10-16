"use client";

import { useEffect, useState } from "react";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

const DISMISSED_UNTIL_KEY = "starz-install-banner-dismissed-until";
const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export default function StarzInstallBanner() {
  const [visible, setVisible] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    function refresh() {
      if (isStandalone()) {
        setVisible(false);
        return;
      }
      const dismissedUntil = Number(localStorage.getItem(DISMISSED_UNTIL_KEY) || 0);
      setVisible(Date.now() >= dismissedUntil);
    }

    function onBeforeInstallPrompt(event: Event) {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
      refresh();
    }

    function onInstalled() {
      setVisible(false);
      setInstallPrompt(null);
      setShowHelp(false);
    }

    refresh();
    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  function dismiss() {
    localStorage.setItem(DISMISSED_UNTIL_KEY, String(Date.now() + SEVEN_DAYS));
    setVisible(false);
  }

  async function install() {
    if (!installPrompt) {
      setShowHelp(true);
      return;
    }
    try {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      setInstallPrompt(null);
      if (choice.outcome === "accepted") setVisible(false);
      else dismiss();
    } catch {
      setShowHelp(true);
    }
  }

  if (!visible) return null;

  return (
    <section aria-label="Install Starz Cricket Club" className="mb-5 rounded-2xl border border-blue-200 bg-gradient-to-r from-blue-950 to-blue-800 p-4 text-white shadow-lg sm:p-5">
      <div className="flex items-start gap-3">
        <div aria-hidden="true" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/15 text-2xl">🏏</div>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-bold sm:text-lg">Install Starz Cricket Club</h2>
          <p className="mt-1 text-sm text-blue-100">Your club, matches, and Messenger—just one tap away.</p>
          {showHelp && (
            <p className="mt-3 rounded-lg bg-white/10 p-3 text-sm text-white" role="status">
              {/(iPad|iPhone|iPod)/i.test(navigator.userAgent)
                ? "In Safari, tap Share, then Add to Home Screen."
                : "In Chrome, tap the three-dot menu (⋮), then Install app (or Add to Home screen)."}
            </p>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" onClick={() => void install()} className="rounded-lg bg-white px-4 py-2 text-sm font-bold text-blue-950 hover:bg-blue-100">Install App</button>
            <button type="button" onClick={dismiss} className="rounded-lg border border-white/40 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10">Not now</button>
          </div>
        </div>
      </div>
    </section>
  );
}
