import { api } from 'meteor/poon-api';
import { Notifications } from '../../db';

api.post('/notifications/:notificationId/received', async (req, res) => {
	await Notifications.updateAsync({
		'_id': req.params.notificationId,
		'channels.deviceId': req.query.deviceId,
	}, {
		$set: {'channels.$.receivedOn': new Date()},
		$unset: {'fallbackOn': 1},
	});
	res.json({'ok': true});
});
