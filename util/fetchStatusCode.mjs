import { get as getHttp } from 'node:http';
import { get as getHttps } from 'node:https';
const protocolToGet = {
	'http:': getHttp,
	'https:': getHttps,
};

function getHttpOrHttps(url, callback) {
	const protocol = (new URL(url)).protocol;
	const get = protocolToGet[protocol];
	if (get === undefined) {
		return null;
	}
	return protocolToGet[protocol](url, callback);
}

export async function fetchResponse(url) {
	return new Promise((resolve, reject) => {
		const request = getHttpOrHttps(url, response => {
			resolve(response);
		});
		if (request === null) {
			reject('Invalid protocol');
		}

		// The request can error if there is no response from the server, or for
		// other reasons, such as the protocol not being 'https':
		request.on('error', httpsError => {
			reject(httpsError);
		});
	});
}

// In the case of a redirect, make another request:
export async function fetchResponseChain(url) {
	const responses = [];
	try {
		while (true) {
			const response = await fetchResponse(url);
			responses.push({ url, result: response.statusCode });
			if (Math.floor(response.statusCode / 100) !== 3) {
				break;
			}
			url = response.headers.location;
		}
	}
	catch (httpsError) {
		responses.push({ url, result: httpsError.code });
	}
	return responses;
}

// For the given URL, make an https request. If a response is received,
// resolve with the 3-digit HTTP response status code. E.G. 404. If a
// response isn't received, reject with error.
export async function fetchStatusCode(url) {
	try {
		const response = await fetchResponse(url);
		return response.statusCode;
	}
	catch (httpsError) {
		throw httpsError.code;
	}
}