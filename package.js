Package.describe({
	name: 'poon-notifications',
	version: '1.0.0',
	summary: 'Poon notifications',
});

Npm.depends({
	'web-push': '3.6.7',
});

Package.onUse(api => {
	api.use('ecmascript');
	api.use('meteor');
	api.use('modules');
	api.use('mongo');
	api.use('random');
	api.use('check');
	api.use('tracker', 'client');
	api.use('webapp', 'server');
	api.use('service-configuration', 'server');
	api.use('poon');
	api.use('poon-api', 'server');
	api.use('poon-devices');
	api.use('poon-jobs', 'server');
	api.mainModule('client.js', 'client');
	api.mainModule('server.js', 'server');
	api.addAssets('assets/service-worker.js', 'server');
});
