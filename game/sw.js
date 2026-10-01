/* Service worker: lưu toàn bộ game vào bộ nhớ đệm để chơi offline khi mở qua http(s) */
const CACHE = 'csgt-patrol-v5';
const FILES = [
  './', 'index.html', 'css/style.css', 'manifest.webmanifest', 'icon.svg',
  'js/util.js', 'js/data.js', 'js/audio.js', 'js/sprites.js', 'js/map.js', 'js/traffic.js',
  'js/player.js', 'js/ui.js', 'js/stop.js', 'js/events.js', 'js/life.js', 'js/main.js'
];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
});
