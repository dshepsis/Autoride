import { get as getHttp } from 'node:http';
import { get as getHttps } from 'node:https';
import { setTimeout as wait } from 'node:timers/promises';

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

function retriableRequest(url, onResponse, onError, {
	retryOnECONNRESET = false,
	numRetries = 0,
	maxRetries = 15,
	retryDelayFactorMS = 100,
	retryDelayExponentialBase = 2,
} = {}) {
	const req = getHttpOrHttps(url, onResponse);
	if (req === null) {
		onError('Invalid protocol');
	}
	if (!retryOnECONNRESET) {
		req.on('error', onError);
		return;
	}
	req.on('error', async err => {
		// Check if retry is needed
		// if (req.reusedSocket && err.code === 'ECONNRESET') {
		if (err.code === 'ECONNRESET') {
			await wait(retryDelayFactorMS * retryDelayExponentialBase ** numRetries);
			++numRetries;
			console.error(`Retrying network request to ${url} due to ECONNRESET at ${Date()} (attempt ${numRetries})...`);
			retriableRequest(url, onResponse, onError, {
				retryOnECONNRESET: retryOnECONNRESET || numRetries < maxRetries,
				numRetries,
				maxRetries,
				retryDelayFactorMS,
				retryDelayExponentialBase,
			});
		}
		// If no retry is necessary, simply call the error callback directly:
		else {
			onError(err);
		}
	});
}

export function fetchResponse(url, {
	retryOnECONNRESET = false,
	maxRetries = 15,
	retryDelayFactorMS = 100,
	retryDelayExponentialBase = 2,
} = {}) {
	return new Promise((resolve, reject) => {
		retriableRequest(url, resolve, reject, {
			retryOnECONNRESET,
			maxRetries,
			retryDelayFactorMS,
			retryDelayExponentialBase,
		});
	});
}

/**
 * Checks a response for the retry-after HTTP header and converts it into a
 * milliseconds delay after now.
 * @param {http.IncomingMessage} response The response to check
 * @returns {number} The number of milliseconds after now that the retry-after
 * header indicates to wait. If there is no retry-after header, returns 0.
 */
function getRetryAfterMS(response) {
	const retryAfterStr = response.headers['retry-after'];
	if (!retryAfterStr) {
		return 0;
	}
	return (/^\d+$/.test(retryAfterStr)
		? 1000 * parseInt(retryAfterStr)
		: new Date(retryAfterStr) - new Date()
	);
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
 * @prop {boolean} isRedirect Whether the given response has an HTTP 3XX status
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
	const MAX_RETRY_DELAY_MS = 5 * 60_000; // 5 minutes
	const MAX_RETRY_COUNT = 5;
	let retryCount = 0;
	try {
		while (true) {
			const response = await fetchResponse(url);
			const isRedirect = (Math.floor(response.statusCode / 100) === 3);
			responses.push({
				url,
				response,
				result: response.statusCode,
				isRedirect,
			});

			// If the status code is 429 Too Many Requests or 503 Service Unavailable,
			// wait for the amount of time indicated by the retry-after header:
			if ([429, 503].includes(response.statusCode)) {
				if (retryCount >= MAX_RETRY_COUNT) {
					break;
				}
				++retryCount;
				const retryDelayMS = getRetryAfterMS(response);
				// If asked to retry after more than 5 minutes, just don't bother and
				// report the error:
				if (retryDelayMS > MAX_RETRY_DELAY_MS) {
					break;
				}
				await wait(retryDelayMS);
				continue;
			}
			if (!isRedirect) {
				break;
			}
			// If given a redirect response, also check for the retry-after header:
			const retryDelayMS = getRetryAfterMS(response);
			if (retryDelayMS > MAX_RETRY_DELAY_MS) {
				break;
			}
			await wait(retryDelayMS);
			url = response.headers.location;
		}
	}
	catch (httpsError) {
		responses.push({ url, result: httpsError.code, isRedirect: false });
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
 * @prop {boolean} wasRetried `true` if any request in the chain was retried due
 * to a 429 or 503 error.
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

	let anyRedirects = false;
	let allRedirects = true;
	for (const responseLink of responseChain) {
		if (responseLink.isRedirect) {
			anyRedirects = true;
		}
		else {
			allRedirects = false;
		}
	}

	/** @type {TestResult} */
	const testResult = {
		responseChain,
		isOK: endResult === 200,
		isRedirect: anyRedirects,
		wasRetried: chainLength > 1 && !allRedirects,
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