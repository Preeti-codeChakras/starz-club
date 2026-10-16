
const CACHE_VERSION = "starz-pwa-v2";

// Install the latest service worker immediately.
self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

// Activate the latest service worker and clear old Starz caches.
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const cacheNames = await caches.keys();

      await Promise.all(
        cacheNames
          .filter((name) => name.startsWith("starz-pwa-"))
          .map((name) => caches.delete(name))
      );

      await self.clients.claim();
    })()
  );
});

// No fetch interception.
// Authenticated pages, Supabase data, chat messages,
// and financial information are never cached here.

// Handle incoming background push notifications.
self.addEventListener("push", (event) => {
  event.waitUntil(
    (async () => {
      let data = {};

      try {
        data = event.data ? event.data.json() : {};
      } catch (error) {
        console.error("[STARZ SW] Invalid push payload", error);
      }

      const title = data.title || "🏏 Starz Messenger";
      const body = data.body || "You have a new Starz message.";
      const kind = data.kind || "message";

      const requestedUrl =
        typeof data.url === "string" ? data.url : "/club-chat";

      // Only allow same-origin navigation.
      const targetUrl = new URL(requestedUrl, self.location.origin);
      const url =
        targetUrl.origin === self.location.origin
          ? targetUrl.href
          : new URL("/club-chat", self.location.origin).href;

      const tag =
        typeof data.tag === "string" && data.tag
          ? data.tag
          : `starz-${Date.now()}`;

      // Display a notification.
      await self.registration.showNotification(title, {
        body,
        icon: "/icons/icon-192.png",
        badge: "/icons/icon-192.png",
        tag,
        renotify: true,
        vibrate: kind === "buzz" ? [250, 100, 250, 100, 350] : [150, 80, 150],
        data: {
          url,
          kind,
        },
      });

      // Request an app-icon badge where supported.
      if ("setAppBadge" in self.navigator) {
        try {
          await self.navigator.setAppBadge();
        } catch (error) {
          console.warn("[STARZ SW] App badge unavailable", error);
        }
      }

      console.log("[STARZ SW] Push notification displayed", {
        kind,
      });
    })()
  );
});

// Open Starz when a notification is tapped.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const target =
    event.notification.data?.url ||
    new URL("/club-chat", self.location.origin).href;

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });

      // Focus an existing Starz window if one is open.
      for (const client of windows) {
        if (client.url.startsWith(self.location.origin)) {
          await client.focus();
          await client.navigate(target);
          return;
        }
      }

      await self.clients.openWindow(target);
    })()
  );
});

// Clear the app badge when a notification is clicked.
self.addEventListener("notificationclick", (event) => {
  event.waitUntil(
    (async () => {
      if ("clearAppBadge" in self.navigator) {
        try {
          await self.navigator.clearAppBadge();
        } catch (error) {
          console.warn("[STARZ SW] Could not clear badge", error);
        }
      }
    })()
  );
});
