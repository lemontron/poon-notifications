import { createJob, RUN } from 'meteor/poon-jobs';
import { Notifications } from '../../db';
import { sendSmsNotificationAsync } from './sms';
import { CHANNEL_SMS } from './constants';

const RETRY_DELAY = 5 * 60 * 1000;

createJob('Notifications Fallback', {
	'mode': RUN,
	'getWork': busyIds => Notifications.findOneAsync({
		'_id': {$nin: busyIds},
		'fallbackOn': {$exists: true, $lte: new Date()},
	}, {
		sort: {'fallbackOn': 1},
	}),
	'runFn': async notification => {
		if (notification.channels.find(r => r.channel === CHANNEL_SMS)) return;

		try {
			const sms = await sendSmsNotificationAsync(notification);
			await Notifications.updateAsync(notification._id, {
				$push: {'channels': sms},
				$unset: {'fallbackOn': 1},
			});
		} catch (err) {
			await Notifications.updateAsync(notification._id, {
				$set: {'fallbackOn': new Date(Date.now() + RETRY_DELAY)},
			});
		}
	},
	'interval': 60 * 1000,
});
