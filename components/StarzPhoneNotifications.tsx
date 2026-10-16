"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type Permission = NotificationPermission | "unsupported";

function decodeKey(key: string): Uint8Array<ArrayBuffer> {
  const padded = key + "=".repeat((4 - (key.length % 4)) % 4);
  const binary = atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export default function StarzPhoneNotifications() {
  const [permission, setPermission] = useState<Permission>("unsupported");
  const [signedIn, setSignedIn] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [checking, setChecking] = useState(true);
  const [installVisible, setInstallVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");

  useEffect(() => {
    let cancelled = false;
    const supported =
      "Notification" in window &&
      "serviceWorker" in navigator &&
      "PushManager" in window;

    if (!supported) {
      setChecking(false);
      return;
    }

    function refreshBannerState() {
      const install = document.querySelector('[aria-label="Install Starz Cricket Club"]');
      setInstallVisible(Boolean(install));
      setPermission(Notification.permission);
    }

    refreshBannerState();
    const observer = new MutationObserver(refreshBannerState);
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("focus", refreshBannerState);

    async function initialize() {
      try {
        const { data, error: authError } = await supabase.auth.getUser();
        if (cancelled) return;
        if (authError || !data.user) {
          setSignedIn(false);
          return;
        }
        setSignedIn(true);

        // Do not equate Android permission with a working server-side registration.
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        if (cancelled || !subscription) return;

        const { data: row, error } = await supabase
          .from("starz_push_subscriptions")
          .select("id")
          .eq("user_id", data.user.id)
          .eq("endpoint", subscription.endpoint)
          .maybeSingle();

        // A failed lookup is not proof that the phone is subscribed.
        if (!cancelled && !error) setSubscribed(Boolean(row));
      } catch {
        // Leave the setup option available if the status cannot be verified.
      } finally {
        if (!cancelled) setChecking(false);
      }
    }

    void initialize();
    return () => {
      cancelled = true;
      observer.disconnect();
      window.removeEventListener("focus", refreshBannerState);
    };
  }, []);

  async function enable() {
    if (busy || permission === "denied") return;
    setBusy(true);
    setStatus("");

    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) throw new Error("Please sign in to enable phone notifications.");

      const publicKey = process.env.NEXT_PUBLIC_STARZ_VAPID_PUBLIC_KEY;
      if (!publicKey) throw new Error("Push notifications have not been configured yet. Please contact a club admin.");

      const result = await Notification.requestPermission();
      setPermission(result);
      if (result !== "granted") {
        setStatus(result === "denied"
          ? "Notifications are blocked. Enable them in Chrome or Android app settings."
          : "Permission wasn't granted. You can try again later.");
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: decodeKey(publicKey),
        });
      }

      const json = subscription.toJSON();
      if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
        throw new Error("Your phone returned an incomplete push subscription.");
      }

      const { error } = await supabase.from("starz_push_subscriptions").upsert({
        user_id: user.id,
        endpoint: json.endpoint,
        p256dh: json.keys.p256dh,
        auth: json.keys.auth,
        user_agent: navigator.userAgent,
      }, { onConflict: "endpoint" });
      if (error) throw error;

      setSubscribed(true);
      setStatus("Phone notifications enabled on this device!");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to enable notifications.");
    } finally {
      setBusy(false);
    }
  }

  // If notifications are not registered, a past dismissal must not hide setup.
  // Keep installation first only when the installation banner is actually visible.
  if (permission === "unsupported" || !signedIn || checking || subscribed || installVisible) return null;

  return (
    <section aria-label="Enable Starz phone notifications" className="mb-5 rounded-2xl border border-blue-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex items-start gap-3">
        <div aria-hidden="true" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-2xl">🔔</div>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-bold text-blue-950 sm:text-lg">Stay connected with Starz! 🏏</h2>
          <p className="mt-1 text-sm text-slate-700">Never miss a club message or BUZZ. Enable phone notifications for group chats, private messages, and BUZZ alerts—even when Starz is closed.</p>
          {permission === "denied" ? (
            <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Notifications are blocked on this phone. Open Chrome site settings or Android app notification settings and allow notifications for Starz.</p>
          ) : (
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" disabled={busy} onClick={() => void enable()} className="rounded-lg bg-blue-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy ? "Enabling…" : "🔔 Enable Notifications"}</button>
            </div>
          )}
          {status && <p role="status" className="mt-3 text-sm text-blue-900">{status}</p>}
        </div>
      </div>
    </section>
  );
}
