/**
 * service-worker.js
 * Cache-first برای پوسته برنامه (App Shell) تا سایت هرگز هنگام قطع اینترنت
 * کاملاً از کار نیفتد. برای درخواست‌های API (OpenWeather) از استراتژی
 * Network-first با fallback به کش استفاده می‌شود (داده تازه در اولویت است،
 * اما در صورت قطعی، آخرین پاسخ کش‌شده نمایش داده می‌شود).
 */

const CACHE_VERSION = "owj-v1";
const SHELL_CACHE = `${CACHE_VERSION}-shell`;
const DATA_CACHE = `${CACHE_VERSION}-data`;

const SHELL_FILES = [
  "./",
  "./index.html",
  "./manifest.json",
  "./css/style.css",
  "./js/config.js",
  "./js/weathercodes.js",
  "./js/state.js",
  "./js/api.js",
  "./js/dust.js",
  "./js/advice.js",
  "./js/alerts.js",
  "./js/ui.js",
  "./js/map.js",
  "./js/charts.js",
  "./js/effects.js",
  "./js/app.js",
  "./assets/icons/favicon.svg",
  "./assets/icons/icon-192.png",
  "./assets/icons/icon-512.png",
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then(cache => cache.addAll(SHELL_FILES))
      .catch(err => console.warn("SW install cache error:", err))
  );
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => !k.startsWith(CACHE_VERSION)).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", event => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== "GET") return;

  // درخواست‌های داده هواشناسی/کیفیت هوا: Network-first، fallback به کش
  const isDataApi = /openweathermap\.org|rainviewer\.com/.test(url.hostname);
  if (isDataApi) {
    event.respondWith(
      fetch(req).then(res => {
        const clone = res.clone();
        caches.open(DATA_CACHE).then(cache => cache.put(req, clone));
        return res;
      }).catch(() => caches.match(req))
    );
    return;
  }

  // فایل‌های اصلی برنامه (Same-origin): Cache-first
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(req).then(cached => cached || fetch(req).then(res => {
        const clone = res.clone();
        caches.open(SHELL_CACHE).then(cache => cache.put(req, clone));
        return res;
      }).catch(() => caches.match("./index.html")))
    );
    return;
  }

  // منابع خارجی دیگر (فونت، Leaflet، Chart.js): Stale-while-revalidate
  event.respondWith(
    caches.match(req).then(cached => {
      const fetchPromise = fetch(req).then(res => {
        caches.open(SHELL_CACHE).then(cache => cache.put(req, res.clone()));
        return res;
      }).catch(() => cached);
      return cached || fetchPromise;
    })
  );
});
