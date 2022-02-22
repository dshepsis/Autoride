const https = require('https');

module.exports = {
	// For the given URL, make an https request. If a response is received,
	// resolve with the 3-digit HTTP response status code. E.G. 404. If a
	// response isn't received, reject with error.
	async fetchStatusCode(url) {
		return new Promise((resolve, reject) => {
			const request = https.get(url, response => {
				resolve(response.statusCode);
			});

			// The request can error if there is no response from the server, or for
			// other reasons, such as the protocol not being 'https':
			request.on('error', httpsError => {
				reject(httpsError.code);
			});
		});
	},
};