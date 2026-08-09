"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

const TIMEOUT_MS = 2 * 60 * 1000;
const LAST_ACTIVITY_KEY = "starz-last-activity";

export default function SessionTimeout() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (
      pathname === "/auth" ||
      pathname === "/privacy"
    ) {
      return;
    }

    let intervalId: ReturnType<typeof setInterval>;

    async function logoutUser() {
      localStorage.removeItem(LAST_ACTIVITY_KEY);

      const { error } =
        await supabase.auth.signOut({
          scope: "local",
        });

      if (error) {
        console.error(
          "Unable to sign out:",
          error
        );
        return;
      }

      router.replace("/auth");
      router.refresh();
    }

    function recordActivity() {
      localStorage.setItem(
        LAST_ACTIVITY_KEY,
        String(Date.now())
      );
    }

    async function initialize() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        return;
      }

      const saved =
        localStorage.getItem(
          LAST_ACTIVITY_KEY
        );

      if (!saved) {
        recordActivity();
      }

      intervalId = setInterval(() => {
        const lastActivity =
          Number(
            localStorage.getItem(
              LAST_ACTIVITY_KEY
            )
          );

        if (!lastActivity) {
          recordActivity();
          return;
        }

        const inactiveFor =
          Date.now() - lastActivity;

        console.log(
          "Inactive for:",
          Math.floor(
            inactiveFor / 1000
          ),
          "seconds"
        );

        if (
          inactiveFor >= TIMEOUT_MS
        ) {
          void logoutUser();
        }
      }, 5000);
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
        recordActivity
      );
    });

    return () => {
      events.forEach((eventName) => {
        window.removeEventListener(
          eventName,
          recordActivity
        );
      });

      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [pathname, router]);

  return null;
}
