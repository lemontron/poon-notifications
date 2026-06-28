# Poon Notifications

Push notifications, in-app notification toasts, notification history, delivery receipts, and SMS fallback for Poon Meteor apps.

## Install

```bash
meteor add poon-notifications
```

This package depends on `poon`, `poon-api`, `poon-devices`, `poon-jobs`, and `poon-router`. It also registers `/service-worker.js` from the package asset bundle.

## What It Does

`poon-notifications` gives a Meteor app one notification API that can target users or devices:

- Stores every notification in the `Notifications` collection.
- Sends Web Push to registered browser devices.
- Shows in-app notifications for logged-in users while the app is open.
- Tracks browser receipt callbacks from the service worker.
- Falls back to SMS through Twilio when a user-targeted push is not received.
- Provides a background job to retry delayed SMS fallback.

## Client Setup

The package registers the service worker automatically on the client. To let a user opt into push notifications, call `setupPush()` from a UI action.

```javascript
import { setupPush } from 'meteor/poon-notifications';
import { PushNotificationsBanner } from 'meteor/poon';

export const NotificationsPrompt = () => (
	<PushNotificationsBanner onEnable={setupPush}/>
);
```

`setupPush()`:

1. Calls `GetPushKey` to get the VAPID public key.
2. Registers the current browser push endpoint through `poon-devices`.
3. Prompts the user when there is no existing push subscription.
4. Saves the endpoint on the current `Devices` document.

Notification clicks are routed through `meteor/poon-router`. The service worker posts the clicked URL back to the app, and the client calls `navigation.go(url)`.

## Sending Notifications

Use `sendNotificationAsync` on the server.

```javascript
import { sendNotificationAsync } from 'meteor/poon-notifications';

await sendNotificationAsync({
	'userIds': [assignedUserId],
	'title': 'Task Assigned',
	'message': 'Check the prep list',
	'url': '/tasks',
});
```

### Send To Multiple Users

```javascript
await sendNotificationAsync({
	'userIds': [managerId, ownerId],
	'title': 'Low Stock',
	'message': 'Milk depletes tomorrow',
	'topic': 'low-stock',
	'url': '/todo/low-stock',
});
```

### Send To Devices

Device-targeted notifications are useful for kiosks, displays, printers, or other registered devices.

```javascript
await sendNotificationAsync({
	'deviceIds': [deviceId],
	'title': 'Display Updated',
	'message': 'Refresh the menu board',
	'url': '/devices',
});
```

Device-targeted notifications do not use SMS fallback because they are not tied to a user phone number.

### Send To A Role

Use `sendNotificationToRoleAsync(role, opts)` when users have a `roles` array on their Meteor user document.

```javascript
import { sendNotificationToRoleAsync } from 'meteor/poon-notifications';
import { ADMIN } from '/imports/constants';

await sendNotificationToRoleAsync(ADMIN, {
	'title': 'Clocked In',
	'message': 'Sam clocked in',
	'url': '/schedule',
});
```

## API

### `sendNotificationAsync(options)`

Server only.

| Option | Default | Description |
| --- | --- | --- |
| `userIds` | `[]` | Meteor user ids to notify. Each user gets a separate notification document. |
| `deviceIds` | `[]` | Device ids from `poon-devices` to notify directly. |
| `title` | | Notification title. |
| `message` | | Notification body. |
| `topic` | `'push'` | Web Push topic, useful for collapsing related notifications. |
| `url` | `Meteor.absoluteUrl('/')` | URL opened when the notification is clicked. Relative app paths work well. |
| `urgency` | `'high'` | Web Push urgency passed to `web-push`. |

If both `userIds` and `deviceIds` are empty, the function returns without doing work.

### `sendNotificationToRoleAsync(role, opts)`

Server only. Finds users where `roles` contains `role`, then calls `sendNotificationAsync({...opts, userIds})`.

### `setupPush()`

Client only. Prompts for browser push permission and stores the browser push endpoint on the current `poon-devices` device.

### `Notifications`

Available on client and server.

```javascript
import { Notifications } from 'meteor/poon-notifications';
```

## Notification Documents

The package stores records in the `Notifications` collection.

```javascript
{
	'_id': '...',
	'userId': '...',          // user-targeted notification
	'deviceId': '...',        // device-targeted notification
	'title': 'Task Assigned',
	'message': 'Check the prep list',
	'topic': 'push',
	'url': '/tasks',
	'urgency': 'high',
	'addedOn': new Date(),
	'fallbackOn': new Date(), // set while waiting for push receipt
	'channels': [{
		'channel': 'push',
		'deviceId': '...',
		'status': 'sent',
		'receivedOn': new Date(),
	}, {
		'channel': 'sms',
		'sid': '...',
		'status': 'queued',
		'to': '+15555555555',
		'from': '+15555550000',
	}],
}
```

`channels` is filled after delivery attempts. Push channel entries include the target device and send status. SMS entries include Twilio response data.

## Delivery Flow

For each target user or device:

1. Insert a `Notifications` document.
2. Find registered devices with saved Web Push endpoints.
3. Send Web Push to each matching device.
4. If at least one push send succeeds for a user notification, set `fallbackOn` five minutes in the future.
5. The service worker receives the push, shows the browser notification, and POSTs a receipt to `/api/notifications/:notificationId/received?deviceId=:deviceId`.
6. The receipt marks `channels.$.receivedOn` and clears `fallbackOn`.
7. If no receipt arrives before `fallbackOn`, the `Notifications Fallback` job sends SMS and clears or retries fallback state.

If no push send succeeds for a user notification, SMS fallback is attempted immediately.

## Configuration

### Web Push

By default, the package creates VAPID keys in `ServiceConfiguration.configurations` with service `poon-web-push`.

For stable keys across environments or deployments, manage this record directly in `ServiceConfiguration.configurations`.

```javascript
await ServiceConfiguration.configurations.upsertAsync({
	'service': 'poon-web-push',
}, {
	$set: {
		'subject': 'mailto:admin@example.com',
		'publicKey': 'B...',
		'privateKey': '...',
	},
});
```

### SMS Fallback

SMS fallback uses Twilio and expects these server settings:

```json
{
	"twilio": {
		"accountSid": "AC...",
		"authToken": "...",
		"from": "+15555550000"
	}
}
```

Users must have `profile.phone` set.

```javascript
await Meteor.users.updateAsync(userId, {
	$set: {'profile.phone': '+15555555555'},
});
```

The SMS body is:

```text
<title>
<message>
<url>
```

## Publications

The package creates an automatic publication for newly added notifications for the current user. This powers in-app notification toasts while the user is online.

It also publishes device delivery history:

```javascript
Meteor.subscribe('NotificationsDevice', deviceId);
```

## Service Worker

The package serves its service worker at:

```text
/service-worker.js
```

The service worker:

- Handles incoming push events.
- Sends receipt callbacks.
- Shows browser notifications.
- Opens or focuses the app when a notification is clicked.
- Passes the clicked app path back to the client router.

Only one service worker can control a scope. If an app has its own root service worker, merge this package's push and notification-click handlers into that worker.

## Testing

Two server methods are available for manual testing:

```javascript
await Meteor.callAsync('TestPushNotifications');
await Meteor.callAsync('TestPushNotificationsDevice', deviceId);
```

`TestPushNotifications` targets the current user. `TestPushNotificationsDevice` targets one device id.

## Troubleshooting

### `setupPush()` does nothing

Check that `GetPushKey` returns a public key. If it returns `null`, Web Push configuration is missing or incomplete.

### Push sends but SMS still fires

The service worker must be active and able to call the receipt API. Check that `/service-worker.js` is registered, that the push payload includes `notificationId` and `deviceId`, and that `/api/notifications/:id/received` is reachable.

### Browser notification opens the wrong page

Use app-relative URLs such as `/tasks/abc123` unless you intentionally want an absolute URL. The service worker resolves relative URLs against the app origin.

### No devices are found

Call `setupPush()` after the user is logged in and make sure `poon-devices` has a current `deviceId`. The push endpoint is stored on the matching `Devices` document.

### SMS fallback fails

Confirm `Meteor.settings.twilio` is configured and the target user has `profile.phone`.
