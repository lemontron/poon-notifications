import { WebApp } from 'meteor/webapp';

WebApp.rawConnectHandlers.use('/service-worker.js', async (req, res) => {
	const serviceWorker = await Assets.getTextAsync('assets/service-worker.js');
	res.writeHead(200, {
		'content-type': 'application/javascript; charset=utf-8',
		'cache-control': 'no-cache',
	});
	res.end(serviceWorker);
});
