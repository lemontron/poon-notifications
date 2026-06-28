import { Meteor } from 'meteor/meteor';
import { CHANNEL_SMS } from './constants';

const callTwilioSmsAsync = async (phone, body) => {
	const {accountSid, authToken, from} = Meteor.settings.twilio;
	const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
		'method': 'POST',
		'headers': {
			'authorization': `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
			'content-type': 'application/x-www-form-urlencoded',
		},
		'body': new URLSearchParams({
			'To': phone,
			'From': from,
			'Body': body,
		}),
	});
	const result = await response.json();
	if (!response.ok) throw new Meteor.Error('twilio', result.message || result.error);
	return result;
};

export const sendSmsNotificationAsync = async notification => {
	const user = await Meteor.users.findOneAsync(notification.userId, {fields: {'profile.phone': 1}});

	if (!user) throw new Meteor.Error('sms', 'User not found or no phone number');
	if (!user.profile.phone) throw new Meteor.Error('sms', 'User has no phone number');

	const body = [
		notification.title,
		notification.message,
		notification.url,
	].filter(Boolean).join('\n');

	const result = await callTwilioSmsAsync(user.profile.phone, body);
	return {
		'channel': CHANNEL_SMS,
		'sid': result.sid,
		'status': result.status,
		'to': result.to,
		'from': result.from,
	};
};
