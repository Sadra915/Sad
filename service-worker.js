/**
 * service-worker.js
 * Cache-first برای پوسته برنامه (App Shell) تا سایت هرگز هنگام قطع اینترنت
 * کاملاً از کار نیفتد. برای درخواست‌های API (Open-Meteo) از استراتژی
 * Network-first با fallback به کش استفاده می‌شود (داده تازه در اولویت است،
 * اما در صورت قطعی، آخرین پاسخ کش‌شده نمایش داده می‌شود).
 *
 * !! نکته مهم !!
 * هر بار که هر کدام از فایل‌های SHELL_FILES (app.js, api.js, config.js, ...)
 * را تغییر می‌دهید، CACHE_VERSION زیر را حتماً عوض کنید (مثلاً v2 -> v3).
 * بدون این کار، مرورگرها متوجه آپدیت نمی‌شوند و نسخه‌ی قدیمی کش‌شده را
 * برای همیشه نشان می‌دهند.
 */

const CACHE_VERSION = "owj-v6";
const SHELL_CACHE = `${CACHE_VERSION}-shell`;
const DATA_CACHE = `${CACHE_VERSION}-data`;

const SHELL_FILES = [
  "./",
  "./index.html",
  "./manifest.json",
  "./style-2.css",
  "./config.js",
  "./weathercodes.js",
  "./state.js",
  "./api.js",
  "./dust.js",
  "./advice.js",
  "./alerts.js",
  "./ui.js",
  "./map.js",
  "./charts.js",
  "./effects.js",
  "./app.js",
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then(cache =>
        Promise.all(
          SHELL_FILES.map(url =>
            fetch(url, { cache: "reload" }) // مرورگر را مجبور می‌کند حتماً از شبکه بگیرد، نه از کش HTTP خودش
              .then(res => cache.put(url, res))
              .catch(err => console.warn("SW precache failed for", url, err))
          )
        )
      )
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
  const isDataApi = /open-meteo\.com|rainviewer\.com/.test(url.hostname);
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