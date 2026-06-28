import { check } from 'meteor/check';
import { Meteor } from 'meteor/meteor';
import { Notifications } from '../../db';

Meteor.publish(null, function() {
	if (!this.userId) return this.ready();

	return Notifications.find({
		'userId': this.userId,
		'addedOn': {$gte: new Date()},
	});
});

Meteor.publish('NotificationsDevice', function(deviceId) {
	check(deviceId, String);
	return Notifications.find({'channels.deviceId': deviceId});
});
