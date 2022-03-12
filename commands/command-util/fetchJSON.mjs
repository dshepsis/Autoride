import { get } from 'https';

// For the given URL, make an https request. If a response is received,
// JSON.parse the response and resolve with the resulting object. If a
// response isn't received, reject with error.
export async function fetchJSON(url) {
	return new Promise((resolve, reject) => {
		get(url, response => {
			response.on('data', d => resolve(JSON.parse(d)));
			response.on('error', e => reject(e));
		});
	});
}