const CACHE_NAME = 'gohano-v1';
const CACHE_URLS = ['/gohano.svg'];

self.addEventListener('install', event => {
	event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(CACHE_URLS)));
});

self.addEventListener('activate', event => {
	event.waitUntil(
		caches.keys().then(keys => Promise.all(
			keys.filter(key => key.startsWith('gohano-') && key !== CACHE_NAME).map(key => caches.delete(key)),
		)),
	);
});

self.addEventListener('fetch', event => {
	if (!CACHE_URLS.includes(new URL(event.request.url).pathname)) return;
	event.respondWith(
		caches.match(event.request).then(cached => cached || fetch(event.request)),
	);
});

self.addEventListener('push', event => {
	const data = event.data ? event.data.json() : {};
	event.waitUntil(
		Promise.all([
			fetch(`/api/notifications/${data.notificationId}/received?deviceId=${data.deviceId}`, {'method': 'POST'}).catch(() => null),
			self.registration.showNotification(data.title, {
				'body': data.body || 'Default body',
				'data': {'url': data.url || '/'},
			}),
		]),
	);
});

self.addEventListener('notificationclick', event => {
	event.notification.close();
	const url = new URL(event.notification.data.url, self.location.origin);
	event.waitUntil(
		clients.matchAll({'type': 'window', 'includeUncontrolled': true}).then(clientList => {
			const client = clientList.find(client => new URL(client.url).origin === url.origin);
			if (!client) return clients.openWindow(url.href);
			client.postMessage({'type': 'notification-click', 'url': url.pathname + url.search});
			return client.focus();
		}),
	);
});
