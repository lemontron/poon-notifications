import { navigation } from 'meteor/poon-router';

if ('serviceWorker' in navigator) {
	navigator.serviceWorker.addEventListener('message', event => {
		if (event.data.type === 'notification-click') navigation.go(event.data.url);
	});
}
