/**
 * Service worker.
 *
 * Chrome will not offer "Add to Home Screen" without one that handles fetch, so
 * this is the difference between the site being installable and not. It also
 * makes the gallery usable offline once visited.
 *
 * Strategies, chosen per resource:
 *   - navigations   network first, falling back to the cached shell offline
 *   - images        cache first, since a photograph at a given URL never changes
 *                   (uploads always get a fresh suffixed path)
 *   - API           network only, so the gallery is never stale
 *   - build assets  cache first, they are content-hashed
 */

// v2: drops the v1 image cache, which could hold multi-megabyte originals the
// image optimizer passed through untouched.
const VERSION = "v2";
const SHELL_CACHE = `shell-${VERSION}`;
const IMAGE_CACHE = `images-${VERSION}`;
const ASSET_CACHE = `assets-${VERSION}`;

/** Keeps the photo cache from growing without bound on a phone. */
const MAX_IMAGES = 120;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(["/"]))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => ![SHELL_CACHE, IMAGE_CACHE, ASSET_CACHE].includes(k))
          .map((k) => caches.delete(k))
      );
      await self.clients.claim();
    })()
  );
});

/**
 * Evicts oldest entries once a cache passes its limit.
 *
 * Listing a cache's keys is not free, and a gallery page asks for dozens of
 * images at once, so this runs at most once every few seconds rather than once
 * per image.
 */
let lastTrim = 0;
const trim = async (cacheName, max) => {
  const now = Date.now();
  if (now - lastTrim < 5000) {
    return;
  }
  lastTrim = now;
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length <= max) {
    return;
  }
  await Promise.all(
    keys.slice(0, keys.length - max).map((k) => cache.delete(k))
  );
};

const IMAGE_EXTENSION = /\.(jpe?g|png|webp|avif|gif|svg)$/i;

const isImage = (request, url) =>
  request.destination === "image" ||
  url.pathname.startsWith("/_vercel/image") ||
  IMAGE_EXTENSION.test(url.pathname);

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);

  // Never cache the API: a stale gallery or a stale session is worse than a
  // spinner.
  if (url.pathname.startsWith("/api/")) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(request);
          const cache = await caches.open(SHELL_CACHE);
          cache.put("/", fresh.clone());
          return fresh;
        } catch {
          // Offline: any route falls back to the cached shell, and the SPA
          // router takes it from there.
          const cached = await caches.match("/", { cacheName: SHELL_CACHE });
          return cached ?? Response.error();
        }
      })()
    );
    return;
  }

  if (isImage(request, url)) {
    event.respondWith(
      (async () => {
        const cached = await caches.match(request, { cacheName: IMAGE_CACHE });
        if (cached) {
          return cached;
        }
        try {
          const fresh = await fetch(request);
          // Hand the image to the page as it streams in, and store the copy
          // afterwards. Awaiting the cache write first held every image back
          // until it had fully downloaded and been written to disk, so nothing
          // could paint progressively and parallel images queued on the cache.
          // Nothing over 8 MB is kept: the cache lives on the visitor's phone.
          const size = Number(fresh.headers.get("content-length") ?? 0);
          if (fresh.ok && size < 8_000_000) {
            const copy = fresh.clone();
            event.waitUntil(
              (async () => {
                const cache = await caches.open(IMAGE_CACHE);
                await cache.put(request, copy);
                await trim(IMAGE_CACHE, MAX_IMAGES);
              })().catch(() => undefined)
            );
          }
          return fresh;
        } catch {
          return Response.error();
        }
      })()
    );
    return;
  }

  if (url.pathname.startsWith("/assets/")) {
    event.respondWith(
      (async () => {
        const cached = await caches.match(request, { cacheName: ASSET_CACHE });
        if (cached) {
          return cached;
        }
        const fresh = await fetch(request);
        if (fresh.ok) {
          // Same as images: answer first, store in the background.
          const copy = fresh.clone();
          event.waitUntil(
            caches
              .open(ASSET_CACHE)
              .then((cache) => cache.put(request, copy))
              .catch(() => undefined)
          );
        }
        return fresh;
      })()
    );
  }
});

/**
 * Notifications for the owner: a proposal opened or signed, an invoice paid.
 * The server sends { title, body, url, tag } (api/_lib/push.ts); a click
 * focuses an open admin tab on that page, or opens one.
 */
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "New activity";
  event.waitUntil(
    self.registration.showNotification(title, {
      badge: data.icon,
      body: data.body || "",
      data: { url: data.url || "/admin" },
      icon: data.icon,
      tag: data.tag,
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(
    event.notification.data?.url || "/admin",
    self.location.origin
  ).href;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({
        includeUncontrolled: true,
        type: "window",
      });
      const admin = windows.find((w) => w.url.includes("/admin"));
      if (admin) {
        await admin.focus();
        return admin.navigate(target);
      }
      return self.clients.openWindow(target);
    })()
  );
});
