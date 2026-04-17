/* SSOB 대진표 서비스워커 — 오프라인 캐시 */
const CACHE_NAME = "ssob-v3";
const CORE_ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icon.svg",
  "./icon-maskable.svg"
];

// 외부 CDN (설치시 캐시 안함, 런타임 캐시)
const RUNTIME_CACHE = "ssob-runtime-v3";

self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(c => c.addAll(CORE_ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME && k !== RUNTIME_CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const req = e.request;
  const url = new URL(req.url);

  // POST/PUT 등 비-GET: 네트워크만
  if (req.method !== "GET") return;

  // AI API 호출(Gemini/Claude/OpenAI): 캐시 안함 - 항상 네트워크
  if (
    url.hostname.includes("generativelanguage.googleapis.com") ||
    url.hostname.includes("api.anthropic.com") ||
    url.hostname.includes("api.openai.com")
  ) return;

  // CDN(라이브러리): 캐시 우선 + 백그라운드 갱신
  if (url.hostname.includes("cdn.jsdelivr.net") || url.hostname.includes("tessdata")) {
    e.respondWith(cacheFirst(req, RUNTIME_CACHE));
    return;
  }

  // 자체 자원: 캐시 우선, 없으면 네트워크
  if (url.origin === location.origin) {
    e.respondWith(cacheFirst(req, CACHE_NAME));
    return;
  }
});

async function cacheFirst(req, cacheName) {
  const cached = await caches.match(req);
  if (cached) return cached;
  try {
    const res = await fetch(req);
    if (res.ok) {
      const cache = await caches.open(cacheName);
      cache.put(req, res.clone());
    }
    return res;
  } catch (err) {
    // 오프라인 + 캐시 미스
    if (req.destination === "document") {
      return caches.match("./index.html");
    }
    throw err;
  }
}
