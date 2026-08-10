"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";


// After testing, change to 1 hours:
const TIMEOUT_MS = 1 * 60 * 60 * 1000;

const LAST_ACTIVITY_KEY = "starz-last-activity";

export default function SessionTimeout() {
  const router = useRouter();
  const pathname = usePathname();

  const loggingOutRef = useRef(false);
  const intervalRef =
    useRef<ReturnType<typeof setInterval> | null>(
      null
    );

  useEffect(() => {
    const publicPages = [
      "/auth",
      "/privacy",
      "/about",
    ];

    if (publicPages.includes(pathname)) {
      return;
    }

    async function logout() {
      if (loggingOutRef.current) {
        return;
      }

      loggingOutRef.current = true;

      console.log("SESSION TIMEOUT: signing out");

      localStorage.removeItem(
        LAST_ACTIVITY_KEY
      );

      const { error } =
        await supabase.auth.signOut({
          scope: "local",
        });

      if (error) {
        console.error(
          "Session timeout sign-out failed:",
          error
        );

        loggingOutRef.current = false;
        return;
      }

      console.log(
        "SESSION TIMEOUT: signed out successfully"
      );

      // Use a hard navigation so nothing
      // from the authenticated React tree remains.
      window.location.href = "/auth";
    }

    function recordActivity() {
      localStorage.setItem(
        LAST_ACTIVITY_KEY,
        Date.now().toString()
      );
    }

    function checkTimeout() {
      const stored =
        localStorage.getItem(
          LAST_ACTIVITY_KEY
        );

      if (!stored) {
        recordActivity();
        return;
      }

      const lastActivity =
        Number(stored);

      const inactiveFor =
        Date.now() - lastActivity;

      console.log(
        "Inactive:",
        Math.floor(inactiveFor / 1000),
        "seconds"
      );

      if (
        inactiveFor >= TIMEOUT_MS
      ) {
        void logout();
      }
    }

    async function initialize() {
      const {
        data: { session },
      } =
        await supabase.auth.getSession();

      if (!session) {
        return;
      }

      const stored =
        localStorage.getItem(
          LAST_ACTIVITY_KEY
        );

      if (!stored) {
        recordActivity();
      }

      checkTimeout();

      intervalRef.current =
        setInterval(
          checkTimeout,
          1000
        );
    }

    void initialize();

    const events = [
      "click",
      "keydown",
      "touchstart",
      "scroll",
    ];

    events.forEach((eventName) => {
      window.addEventListener(
        eventName,
        recordActivity,
        {
          passive: true,
        }
      );
    });

    function handleVisibilityChange() {
      if (
        document.visibilityState ===
        "visible"
      ) {
        checkTimeout();
      }
    }

    document.addEventListener(
      "visibilitychange",
      handleVisibilityChange
    );

    return () => {
      events.forEach((eventName) => {
        window.removeEventListener(
          eventName,
          recordActivity
        );
      });

      document.removeEventListener(
        "visibilitychange",
        handleVisibilityChange
      );

      if (intervalRef.current) {
        clearInterval(
          intervalRef.current
        );
      }
    };
  }, [pathname, router]);

  return null;
}
