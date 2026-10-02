// Record delivery and display incoming push notifications.
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

// Open or focus the app and route it to the notification target.
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
