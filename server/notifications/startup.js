import { Meteor } from 'meteor/meteor';
import { Notifications } from '../../db';

const ensureNotificationIndexAsync = async () => {
	try {
		await Notifications.rawCollection().createIndex(
			{fallbackOn: 1},
			{name: 'notifications_fallback', background: true});
	} catch (error) {
		if (!['IndexOptionsConflict', 'IndexKeySpecsConflict'].includes(error.codeName)) throw error;
		await Notifications.rawCollection().dropIndex('notifications_fallback');
		await Notifications.rawCollection().createIndex(
			{fallbackOn: 1},
			{name: 'notifications_fallback', background: true});
	}
};

Meteor.startup(async () => {
	try {
		await ensureNotificationIndexAsync();
	} catch (error) {
		console.error('Failed to ensure notification indexes', error);
	}
});
