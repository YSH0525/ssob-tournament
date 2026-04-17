/* SSOB 대진표 서비스워커 — network-first로 항상 최신 */
const CACHE_NAME = "ssob-v5";
const RUNTIME_CACHE = "ssob-runtime-v5";

self.addEventListener("install", e => {
  self.skipWaiting(); // 설치 즉시 활성화
});

self.addEventListener("activate", e => {
  e.waitUntil((async () => {
    // 옛 캐시 전부 삭제
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE_NAME && k !== RUNTIME_CACHE).map(k => caches.delete(k)));
    // 모든 탭 즉시 제어권 획득
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // AI API: 항상 네트워크, 캐시 절대 안함
  if (
    url.hostname.includes("generativelanguage.googleapis.com") ||
    url.hostname.includes("api.anthropic.com") ||
    url.hostname.includes("api.openai.com") ||
    url.hostname.includes("supabase.co")
  ) return;

  // HTML/JS/CSS 자체 자원: network-first (새 버전 즉시 반영)
  if (url.origin === location.origin) {
    e.respondWith(networkFirst(req, CACHE_NAME));
    return;
  }

  // CDN 라이브러리: cache-first (버전 고정 URL이라 안전)
  if (url.hostname.includes("cdn.jsdelivr.net") || url.hostname.includes("tessdata")) {
    e.respondWith(cacheFirst(req, RUNTIME_CACHE));
    return;
  }
});

async function networkFirst(req, cacheName) {
  try {
    const res = await fetch(req);
    if (res.ok) {
      const cache = await caches.open(cacheName);
      cache.put(req, res.clone());
    }
    return res;
  } catch (err) {
    const cached = await caches.match(req);
    if (cached) return cached;
    if (req.destination === "document") {
      return caches.match("./index.html");
    }
    throw err;
  }
}

async function cacheFirst(req, cacheName) {
  const cached = await caches.match(req);
  if (cached) return cached;
  const res = await fetch(req);
  if (res.ok) {
    const cache = await caches.open(cacheName);
    cache.put(req, res.clone());
  }
  return res;
}

// 수동 업데이트 트리거
self.addEventListener("message", e => {
  if (e.data === "skipWaiting") self.skipWaiting();
  if (e.data === "clearCaches") {
    caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k))));
  }
});
