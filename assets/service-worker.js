const CACHE_NAME = 'gohano-app';
const SHELL_URL = '/__gohano_app_shell__';
const STATIC_URLS = ['/dashboard.json', '/gohano.svg', '/icons/icon.png'];
const STATIC_DESTINATIONS = new Set(['font', 'image', 'manifest', 'script', 'style']);

const getShellUrls = html => {
	const urls = [...html.matchAll(/(?:src|href)=["']([^"']+)["']/g)].map(match => new URL(match[1], self.location.origin));
	return [...new Set([
		...STATIC_URLS.map(path => new URL(path, self.location.origin).href),
		...urls.filter(url => url.origin === self.location.origin).map(url => url.href),
	])];
};

const cacheShell = async response => {
	const cache = await caches.open(CACHE_NAME);
	const html = await response.clone().text();
	await cache.put(SHELL_URL, response);
	await Promise.all(getShellUrls(html).map(async url => {
		const asset = await fetch(url, {cache: 'no-store'});
		if (asset.ok) await cache.put(url, asset);
	}));
};

self.addEventListener('install', event => {
	event.waitUntil((async () => {
		const response = await fetch('/', {cache: 'no-store'});
		if (!response.ok) throw new Error(`Unable to cache Gohano: ${response.status}`);
		await cacheShell(response);
		await self.skipWaiting();
	})());
});

self.addEventListener('activate', event => {
	event.waitUntil((async () => {
		const keys = await caches.keys();
		await Promise.all(keys.filter(key => key.startsWith('gohano-') && key !== CACHE_NAME).map(key => caches.delete(key)));
		await self.clients.claim();
	})());
});

self.addEventListener('fetch', event => {
	const {request} = event;
	if (request.method !== 'GET') return;

	if (request.mode === 'navigate') {
		const response = fetch(request);
		event.waitUntil(response.then(result => {
			if (result.ok && result.headers.get('content-type')?.includes('text/html')) return cacheShell(result.clone());
		}).catch(() => {}));
		event.respondWith(response.catch(() => caches.match(SHELL_URL)));
		return;
	}

	const url = new URL(request.url);
	if (url.origin !== self.location.origin || !STATIC_DESTINATIONS.has(request.destination)) return;

	event.respondWith((async () => {
		const cached = await caches.match(request);
		if (cached) return cached;
		const response = await fetch(request);
		if (response.ok) await (await caches.open(CACHE_NAME)).put(request, response.clone());
		return response;
	})());
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
