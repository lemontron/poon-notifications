import { Meteor } from 'meteor/meteor';
import { Tracker } from 'meteor/tracker';
import { Notifications } from '../db';
import { showNotification } from 'meteor/poon';

Meteor.startup(() => {
	let userId;
	let observer;

	Tracker.autorun(() => {
		const nextUserId = Meteor.userId();
		if (nextUserId === userId) return;

		userId = nextUserId;
		if (observer) observer.stop();
		if (!userId) return;

		const startedOn = new Date();
		observer = Notifications.find({
			userId,
			'addedOn': {$gte: startedOn},
		}).observe({
			added: notification => showNotification({
				'title': notification.title,
				'body': notification.message,
				'icon': 'notifications',
			}),
		});
	});
});
