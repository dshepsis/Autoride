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

/**
 * @typedef {Object} ResponseLink An object storing information about a link in
 * the chain of URLs and status codes resulting from following the chain of
 * redirects (if any) from an initial URL.
 * @prop {string} url The URL to which an HTTP(S) request was made
 * @prop {http.IncomingMessage} [response] The HTTP(S) response object for the
 * request. Omitted if the result is a Node request error
 * @prop {number|string} result Either the number HTTP status code for this
 * request (e.g. 200 for OK, 301 for Moved Permanent, 404 for Not Found), or the
 * string Node request error code (e.g. 'ENOTFOUND' if no response is received)
 */
/**
 * Makes a request to the URL and follows any HTTP redirect responses
 * (HTTP 3XX).
 * @param {string} url The URL to make an initial HTTP(S) request to
 * @returns {Promise<ResponseLink[]>} An ordered array of objects describing the result
 * of each request
 */
export async function fetchResponseChain(url) {
	/** @type{ResponseLink[]} */
	const responses = [];
	try {
		while (true) {
			const response = await fetchResponse(url);
			responses.push({ url, response, result: response.statusCode });
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


/**
 * @typedef {Object} TestResult An object storing information about the
 * result of testing the HTTP(S) response for a given URL
 * @prop {ResponseLink[]} responseChain The return value of `fetchResponseChain`
 * called on the given URL
 * @prop {boolean} isOK `true` if the end of the redirect chain (if any) results
 * in an HTTP 200 OK response
 * @prop {boolean} isRedirect `true` if the response to the given URL is an HTTP
 * redirect (HTTP 3XX responses)
 * @prop {string} startUrl The given URL
 * @prop {string} endUrl The final URL in the redirect chain, which may be equal
 * to startUrl if the given URL did not result in an HTTP redirect
 * @prop {number} [endStatusCode] The final HTTP status code in the response
 * chain. Omitted if the chain results in a Node request error.
 * @prop {string} [nodeError] The Node request error code at the end of the
 * response chain. Omitted if the chain ends with a HTTP response (whether that
 * be OK or an error).
 */
/**
 * Checks a URL, following redirects if necessary, and returns an object
 * containing detailed data about the result
 * @param {string} url The URL to check
 * @returns {Promise<TestResult>} An object containing detailed data about the
 * result of making a request to the given URL and following any HTTP redirects
 */
export async function testUrl(url) {
	const responseChain = await fetchResponseChain(url);
	const chainLength = responseChain.length;
	const endResponse = responseChain[chainLength - 1];
	const endResult = endResponse.result;

	/** @type {TestResult} */
	const testResult = {
		responseChain,
		isOK: endResult === 200,
		isRedirect: chainLength > 1,
		startUrl: url,
		endUrl: endResponse.url,
	};
	if (typeof endResult === 'number') {
		testResult.endStatusCode = endResult;
	}
	else {
		testResult.nodeError = endResult;
	}

	return testResult;
}

// For the given URL, make an https request. If a response is received,
// resolve with the 3-digit HTTP response status code. E.G. 404. If a
// response isn't received, reject with error.
export async function fetchStatusCode(url) {
	let response;
	try {
		response = await fetchResponse(url);
	}
	catch (httpsError) {
		throw httpsError.code;
	}
	return response.statusCode;
}