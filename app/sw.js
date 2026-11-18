// Service worker: lets the app open without coverage.
// Network first, so a new version always wins when there is a connection;
// the cached copy is only used when the network does not answer.

const CACHE = 'limna-v2';
const SHELL = [
  './', 'index.html', 'css/limna.css', 'icon.svg', 'manifest.webmanifest',
  'js/app.js', 'js/views.js', 'js/model.js', 'js/calc.js', 'js/sim.js', 'js/crops.js',
  'js/defaults.js', 'js/store.js', 'js/charts.js', 'js/map.js', 'js/icons.js', 'js/util.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request).then((hit) => hit || caches.match('index.html'))),
  );
});
