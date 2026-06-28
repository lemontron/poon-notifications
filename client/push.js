import { Meteor } from 'meteor/meteor';
import { callMethod, GRANTED, pushNotifications, showAlert, toast } from 'meteor/poon';
import { deviceId } from 'meteor/poon-devices';

export const setupPush = async () => {
	const publicKey = await Meteor.callAsync('GetPushKey');
	if (!publicKey) {
		console.info('[poon] Web Push public key is not configured; skipping push setup.');
		return;
	}

	const existing = await pushNotifications.getConfigAsync();
	if (existing) return callMethod('PushNotifications', {
		'data': {'deviceId': deviceId, 'endpoint': existing},
	});

	const ok = await showAlert({
		'title': 'Push Notifications',
		'message': 'Enable notifications?',
	}, [
		{'_id': 'cancel', 'name': 'No'},
		{'_id': 'enable', 'name': 'Enable'},
	]);
	if (ok === 'enable') {
		const status = await pushNotifications.askAsync({
			'userVisibleOnly': true,
			'applicationServerKey': publicKey,
		});
		if (status === GRANTED) callMethod('PushNotifications', {
			'data': {'deviceId': deviceId, 'endpoint': await pushNotifications.getConfigAsync()},
			'onSuccess': () => toast('Push subscribed'),
		});
	} else if (ok === 'cancel') {
		pushNotifications.userDecline();
	}
};
