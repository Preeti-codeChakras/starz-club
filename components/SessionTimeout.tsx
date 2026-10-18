"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

const TIMEOUT_MS = 60 * 60 * 1000;
const LAST_ACTIVITY_KEY = "starz-last-activity";

function isInstalledApp(): boolean {
  // Android/desktop installed PWAs typically use display-mode: standalone.
  // iOS Home Screen apps also expose navigator.standalone.
  const standaloneDisplay = window.matchMedia("(display-mode: standalone)").matches;
  const fullscreenDisplay = window.matchMedia("(display-mode: fullscreen)").matches;
  const iosStandalone =
    "standalone" in navigator &&
    (navigator as Navigator & { standalone?: boolean }).standalone === true;

  return standaloneDisplay || fullscreenDisplay || iosStandalone;
}

export default function SessionTimeout() {
  const pathname = usePathname();
  const loggingOutRef = useRef(false);

  useEffect(() => {
    // An installed Starz app relies on Supabase's persistent session instead
    // of the website's inactivity timer. No timer or activity listeners are added.
    if (isInstalledApp()) return;

    const publicPages = ["/auth", "/privacy", "/about"];
    if (publicPages.includes(pathname)) return;

    let cancelled = false;
    let intervalId: ReturnType<typeof setInterval> | undefined;

    async function logout() {
      if (loggingOutRef.current || cancelled) return;
      loggingOutRef.current = true;
      localStorage.removeItem(LAST_ACTIVITY_KEY);

      const { error } = await supabase.auth.signOut({ scope: "local" });
      if (cancelled) return;

      if (error) {
        console.error("Session timeout sign-out failed:", error);
        loggingOutRef.current = false;
        return;
      }

      window.location.href = "/auth";
    }

    function recordActivity() {
      if (!loggingOutRef.current) {
        localStorage.setItem(LAST_ACTIVITY_KEY, Date.now().toString());
      }
    }

    function checkTimeout() {
      if (cancelled || loggingOutRef.current) return;
      const stored = localStorage.getItem(LAST_ACTIVITY_KEY);
      if (!stored) {
        recordActivity();
        return;
      }
      const lastActivity = Number(stored);
      if (!Number.isFinite(lastActivity) || lastActivity <= 0) {
        recordActivity();
        return;
      }
      if (Date.now() - lastActivity >= TIMEOUT_MS) void logout();
    }

    const events = ["click", "keydown", "touchstart", "scroll"] as const;
    function handleVisibilityChange() {
      if (document.visibilityState === "visible") checkTimeout();
    }

    async function initialize() {
      const { data: { session } } = await supabase.auth.getSession();
      if (cancelled || !session) return;

      checkTimeout();
      if (loggingOutRef.current) return;

      intervalId = setInterval(checkTimeout, 1000);
      events.forEach(eventName => window.addEventListener(eventName, recordActivity, { passive: true }));
      document.addEventListener("visibilitychange", handleVisibilityChange);
    }

    void initialize();

    return () => {
      cancelled = true;
      events.forEach(eventName => window.removeEventListener(eventName, recordActivity));
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (intervalId) clearInterval(intervalId);
    };
  }, [pathname]);

  return null;
}
