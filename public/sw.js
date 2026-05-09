/**
 * Growth Suite - Service Worker
 * Cache-first for static assets, network-first for API calls
 * Offline fallback with cached data, background sync for scheduled tweets
 */

const CACHE_VERSION = 'growth-suite-v1';
const STATIC_CACHE = CACHE_VERSION + '-static';
const API_CACHE = CACHE_VERSION + '-api';

// App shell files to pre-cache on install
const APP_SHELL = [
  '/',
  '/index.html',
  '/css/style.css',
  '/js/app.js',
  '/js/utils/escapeHtml.js',
  '/js/utils/chart.js',
  '/js/components/growth.js',
  '/js/components/scheduler.js',
  '/js/components/threads.js',
  '/js/components/leads.js',
  '/manifest.json',
  '/icons/icon-192.svg',
  '/icons/icon-512.svg'
];

// Install: pre-cache the app shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

// Activate: clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== STATIC_CACHE && key !== API_CACHE)
          .map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch: strategy based on request type
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests (let them pass through)
  if (request.method !== 'GET') {
    return;
  }

  // API calls: network-first strategy
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Static assets: cache-first strategy
  event.respondWith(cacheFirst(request));
});

/**
 * Cache-first strategy for static assets
 * Returns cached version if available, otherwise fetches from network and caches
 */
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) {
    return cached;
  }

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    // If offline and not in cache, return offline fallback for navigation
    if (request.mode === 'navigate') {
      const cachedIndex = await caches.match('/index.html');
      if (cachedIndex) return cachedIndex;
    }
    return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
  }
}

/**
 * Network-first strategy for API calls
 * Tries network first for fresh data, falls back to cached response
 */
async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(API_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    // Offline: return cached API response
    const cached = await caches.match(request);
    if (cached) {
      return cached;
    }
    return new Response(
      JSON.stringify({ error: 'offline', message: 'No cached data available' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

// Background sync for scheduled tweets
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-scheduled-tweets') {
    event.waitUntil(syncScheduledTweets());
  }
});

async function syncScheduledTweets() {
  try {
    // Get queued tweets from the sync store
    const cache = await caches.open(CACHE_VERSION + '-sync');
    const requests = await cache.keys();

    for (const request of requests) {
      const response = await cache.match(request);
      if (response) {
        const body = await response.json();
        try {
          await fetch('/api/scheduler/tweets', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
          });
          await cache.delete(request);
        } catch (e) {
          // Will retry on next sync
        }
      }
    }
  } catch (e) {
    // Sync failed, will retry
  }
}

// Listen for messages from the main thread
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
