/* IntelliHorizon service worker.
 * - Static build assets: cache-first (file names are content-hashed).
 * - Pages: network-first. Only pages the server marks cacheable are stored, and the server marks every page
 *   rendered for a signed-in student "private, no-store", so no student's data is ever kept here.
 * - Server functions and API calls are never cached.
 * - Updates: every build has its own version; a new worker takes over at once and removes the old caches.
 */
// Replaced at build time with a hash of this build's assets (vite.config.ts), so every deploy installs a new worker
// and its "activate" step deletes the previous version's caches. Never edit by hand.
const VERSION = "__IH_BUILD__";
const PAGES = `pages-${VERSION}`;
const STATIC = `static-${VERSION}`;
const PRECACHE = ["/offline.html", "/manifest.webmanifest", "/favicon.svg", "/icon-192.png", "/icon-512.png"];
const PUBLIC_PAGES = ["/", "/help", "/privacy"];

self.addEventListener("install", (e) => {
  // Take over as soon as this build's caches are ready: pages are network-first and assets are content-hashed, so
  // switching mid-session is safe, and "activate" then deletes the previous build's caches (including any old copy of
  // a public page). The page is never reloaded by this; a reload happens only when the student asks for one.
  self.skipWaiting();
  e.waitUntil((async () => {
    const s = await caches.open(STATIC);
    await s.addAll(PRECACHE);
    // The app shell (hashed JS and CSS from this build), so pages work offline after the first visit.
    try {
      const list = await (await fetch("/sw-assets.json", { cache: "no-store" })).json();
      await Promise.allSettled(list.map((f) => s.add("/" + f)));
    } catch { /* list missing in development: assets are cached as they are used */ }
    const p = await caches.open(PAGES);
    // Public pages are fetched without cookies, so the cached copy is the signed-out version.
    await Promise.allSettled(PUBLIC_PAGES.map(async (u) => {
      const res = await fetch(u, { credentials: "omit" });
      if (res.ok && !/no-store/.test(res.headers.get("cache-control") || "")) await p.put(u, res);
    }));
  })());
});

self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== PAGES && k !== STATIC).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener("message", (e) => {
  if (e.data === "SKIP_WAITING") self.skipWaiting();
  if (e.data === "CLEAR_PAGES") e.waitUntil(caches.delete(PAGES));
});

const NEVER = /^\/(_serverFn|api)\b|^\/(account|signin|signup|login|reset-password|verify-email|forgot-password|admin)/;

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;
  if (sameOrigin && NEVER.test(url.pathname)) return;

  if (req.mode === "navigate" && sameOrigin) {
    e.respondWith((async () => {
      try {
        const res = await fetch(req);
        const cc = res.headers.get("cache-control") || "";
        if (res.ok && !/no-store|private/.test(cc)) {
          const copy = res.clone();
          caches.open(PAGES).then((c) => c.put(url.pathname, copy));
        }
        return res;
      } catch {
        const hit = (await caches.match(url.pathname, { cacheName: PAGES })) || (await caches.match("/offline.html"));
        if (!hit) return Response.error();
        // Rebuild the response so a cached redirect can never be replayed for a navigation.
        return new Response(await hit.blob(), { status: 200, headers: { "content-type": hit.headers.get("content-type") || "text/html; charset=utf-8" } });
      }
    })());
    return;
  }

  const isFont = url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com";
  if ((sameOrigin && (url.pathname.startsWith("/assets/") || /\.(css|js|svg|png|woff2?|webmanifest)$/.test(url.pathname))) || isFont) {
    e.respondWith((async () => {
      const hit = await caches.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok || res.type === "opaque") {
        const copy = res.clone();
        caches.open(STATIC).then((c) => c.put(req, copy));
      }
      return res;
    })());
  }
});
