const https = require('https');

module.exports = {
	async fetchJson(url) {
		return new Promise((resolve, reject) => {
			https.get(url, response => {
				response.on('data', d => resolve(JSON.parse(d)));
				response.on('error', e => reject(e));
			});
		});
	},
};