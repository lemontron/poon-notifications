# Poon Notifications

Push notification and notification history utilities for Poon Meteor apps.

## Usage

```bash
meteor add poon-notifications
```

```javascript
import { sendNotificationAsync } from 'meteor/poon-notifications';

await sendNotificationAsync({
	'userIds': [userId],
	'title': 'Task Assigned',
	'message': 'Check the prep list',
	'url': '/tasks',
});
```
