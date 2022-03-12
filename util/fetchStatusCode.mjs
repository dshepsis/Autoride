import { get } from 'https';

// For the given URL, make an https request. If a response is received,
// resolve with the 3-digit HTTP response status code. E.G. 404. If a
// response isn't received, reject with error.
export async function fetchStatusCode(url) {
	return new Promise((resolve, reject) => {
		const request = get(url, response => {

			resolve(response.statusCode);
		});

		// The request can error if there is no response from the server, or for
		// other reasons, such as the protocol not being 'https':
		request.on('error', httpsError => {
			reject(httpsError.code);
		});
	});
}