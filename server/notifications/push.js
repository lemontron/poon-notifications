import { Meteor } from 'meteor/meteor';
import { check } from 'meteor/check';
import { ServiceConfiguration } from 'meteor/service-configuration';
import { Devices } from 'meteor/poon-devices';
import webPush from 'web-push';

const PUSH_SERVICE = 'poon-web-push';
const DEFAULT_SUBJECT = 'mailto:admin@poon.app';

let configuredFingerprint;

const getSettingsWebPushConfig = () => {
	const config = Meteor.settings?.packages?.poon?.webPush;
	if (!config?.publicKey || !config?.privateKey) return null;
	return {
		'service': PUSH_SERVICE,
		'subject': config.subject || (config.email ? `mailto:${config.email}` : DEFAULT_SUBJECT),
		'publicKey': config.publicKey,
		'privateKey': config.privateKey,
	};
};

const ensureServiceWebPushConfigAsync = async () => {
	const existing = await ServiceConfiguration.configurations.findOneAsync({'service': PUSH_SERVICE});
	if (existing) return existing;

	const settingsConfig = getSettingsWebPushConfig();
	if (settingsConfig) {
		await ServiceConfiguration.configurations.upsertAsync({'service': PUSH_SERVICE}, {
			$setOnInsert: settingsConfig,
		});
		return ServiceConfiguration.configurations.findOneAsync({'service': PUSH_SERVICE});
	}

	const keys = webPush.generateVAPIDKeys();
	await ServiceConfiguration.configurations.upsertAsync({'service': PUSH_SERVICE}, {
		$setOnInsert: {
			'service': PUSH_SERVICE,
			'subject': DEFAULT_SUBJECT,
			'publicKey': keys.publicKey,
			'privateKey': keys.privateKey,
		},
	});
	return ServiceConfiguration.configurations.findOneAsync({'service': PUSH_SERVICE});
};

const getWebPushConfigAsync = async () => {
	return ensureServiceWebPushConfigAsync();
};

const configureWebPushAsync = async () => {
	const config = await getWebPushConfigAsync();
	if (!config?.subject || !config?.publicKey || !config?.privateKey) return null;

	const fingerprint = `${config.subject}:${config.publicKey}:${config.privateKey}`;
	if (fingerprint !== configuredFingerprint) {
		webPush.setVapidDetails(config.subject, config.publicKey, config.privateKey);
		configuredFingerprint = fingerprint;
	}
	return config;
};

export const sendDevicePushNotificationAsync = async (device, notification) => {
	const config = await configureWebPushAsync();
	if (!config) throw new Meteor.Error('push', 'Web Push is not configured');

	const payload = JSON.stringify({
		'notificationId': notification._id,
		'deviceId': device._id,
		'title': notification.title,
		'body': notification.message,
		'url': notification.url,
	});
	const result = await webPush.sendNotification(device.endpoint, payload, {
		'urgency': notification.urgency,
		'topic': notification.topic,
	});
	if (result.statusCode >= 400) {
		throw new Meteor.Error('push', `Push failed with status ${result.statusCode}`, {
			'code': result.statusCode,
		});
	}
};

Meteor.methods({
	'GetPushKey': async function() {
		const config = await configureWebPushAsync();
		return config?.publicKey || null;
	},
	'PushNotifications': async function(d) {
		const config = await configureWebPushAsync();
		if (!config) throw new Meteor.Error('push', 'Web Push is not configured');

		check(d, {deviceId: String, endpoint: Object});
		check(d.endpoint.endpoint, String);

		await Devices.updateAsync(d.deviceId, {
			$set: {'endpoint': d.endpoint},
		});
	},
});
