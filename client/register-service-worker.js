import { navigation } from 'meteor/poon-router';

if ('serviceWorker' in navigator) {
	navigator.serviceWorker.register('/service-worker.js').catch(error => {
		console.error('Service Worker registration failed:', error);
	});

	navigator.serviceWorker.addEventListener('message', event => {
		if (event.data.type === 'notification-click') navigation.go(event.data.url);
	});
}
