const CACHE_VERSION = "starz-pwa-v1";

self.addEventListener("install", () => {
  self.skipWaiting();
});

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

// No fetch interception yet.
// All requests continue directly to the network.
// This avoids caching authenticated pages,
// Supabase responses, chat messages, or financial data.
