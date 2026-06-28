import { Meteor } from 'meteor/meteor';
import { check } from 'meteor/check';
import { Devices } from 'meteor/poon-devices';
import { Notifications } from '../../db';
import { sendDevicePushNotificationAsync } from './push';
import { sendSmsNotificationAsync } from './sms';
import { CHANNEL_PUSH, CHANNEL_SMS, RESULT_ERROR, RESULT_SENT } from './constants';

const RECEIPT_TIMEOUT = 5 * 60 * 1000;

const carefullySendPushNotificationsAsync = async notification => {
	const query = {
		'endpoint': {$exists: true},
	};
	if (notification.deviceId) query._id = notification.deviceId;
	if (notification.userId) query.userId = notification.userId;

	const devices = await Devices.find(query).fetchAsync();

	const results = await Promise.allSettled(devices.map(device => {
		return sendDevicePushNotificationAsync(device, notification);
	}));

	return results.map((result, i) => ({
		'channel': CHANNEL_PUSH,
		'deviceId': devices[i]._id,
		...(result.status === 'fulfilled' ? {
			'status': RESULT_SENT,
		} : {
			'status': RESULT_ERROR,
			'error': result.reason.toString(),
			'details': result.reason.details,
		}),
	}));
};

const carefullySendSmsFallbackAsync = async notification => {
	try {
		const sms = await sendSmsNotificationAsync(notification);
		await Notifications.updateAsync(notification._id, {
			$push: {'channels': sms},
			$unset: {'fallbackOn': 1},
		});
	} catch (err) {
		await Notifications.updateAsync(notification._id, {
			$push: {'channels': {'channel': CHANNEL_SMS, 'error': err.toString()}},
		});
	}
};

const sendRecipientNotificationAsync = async (notification) => {
	notification._id = await Notifications.insertAsync(notification);

	const useSmsFallback = !!notification.userId;

	const pushResults = await carefullySendPushNotificationsAsync(notification);
	if (pushResults.some(r => r.status === RESULT_SENT)) {
		const fields = {'channels': pushResults};
		if (useSmsFallback) fields.fallbackOn = new Date(Date.now() + RECEIPT_TIMEOUT);

		await Notifications.updateAsync(notification._id, {$set: fields});
		return;
	}

	if (useSmsFallback) {
		await carefullySendSmsFallbackAsync(notification);
	} else {
		await Notifications.updateAsync(notification._id, {
			$set: {'channels': pushResults},
		});
	}
};

export const sendNotificationAsync = async ({
	userIds = [],
	deviceIds = [],
	title,
	message,
	topic = 'push',
	url = Meteor.absoluteUrl('/'),
	urgency = 'high',
} = {}) => {
	if (userIds.length === 0 && deviceIds.length === 0) return;

	const template = {
		title,
		message,
		topic,
		url,
		urgency,
		'addedOn': new Date(),
	};

	await Promise.allSettled([
		...userIds.map(userId => sendRecipientNotificationAsync({...template, userId})),
		...deviceIds.map(deviceId => sendRecipientNotificationAsync({...template, deviceId})),
	]);
};

// Helper
export const sendNotificationToRoleAsync = async (role, opts) => {
	const users = await Meteor.users.find({'roles': role}, {fields: {'_id': 1}}).fetchAsync();
	const userIds = users.map(u => u._id);
	return sendNotificationAsync({...opts, userIds});
};

Meteor.methods({
	'TestPushNotifications': async function() {
		await sendNotificationAsync({
			'userIds': [this.userId],
			'title': 'Message',
			'message': `Sent at ${new Date().toLocaleString()}`,
			'topic': 'push',
			'url': Meteor.absoluteUrl('/'),
		});
	},
	'TestPushNotificationsDevice': async function(deviceId) {
		check(deviceId, String);
		await sendNotificationAsync({
			'deviceIds': [deviceId],
			'title': 'Message',
			'message': `Sent at ${new Date().toLocaleString()}`,
			'topic': 'push',
			'url': Meteor.absoluteUrl('/'),
		});
	},
});
;
