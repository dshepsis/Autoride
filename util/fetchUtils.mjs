import { get as getHttp } from 'node:http';
import { get as getHttps } from 'node:https';
import { setTimeout as wait } from 'node:timers/promises';
import { lookup as dnsLookup } from 'node:dns';
import { isIP } from 'node:net';
import { urlToHttpOptions } from 'node:url';

import ipaddr from 'ipaddr.js';

class LocalIPBlockedError extends Error {
	name = this.constructor.name;
	code = 'ENOTFOUND';
	hostname;
	constructor(hostname) {
		super(`IP Address "${hostname}" blocked due to being in range outside unicast.`);
		this.hostname = hostname;
	}
}

/**
 * A function meant to be used as a custom `lookup` function in the options of
 * http(s).request/get. This is used to block requests to local IPs, so as to
 * protect against SSRF (even if that possibility is really slim):
 * @param {string} hostname The request's hostname
 * @param {object} options DNS options object. See:
 * https://nodejs.org/api/dns.html#dnslookuphostname-options-callback
 * @param {function} callback DNS lookup callback. Called normally unless the
 * resolved IP address is outside the unicast range (as determined by ipaddr.js)
 * in which case a custom error is passed.
 */
function blockLocalLookup(hostname, options, callback) {
	return dnsLookup(hostname, options, (err, address, family) => {
		if (err) return callback(err, address, family);

		// Check that the address isn't local:
		const addressData = ipaddr.parse(address);
		if (addressData.range() === 'unicast') {
			return callback(err, address, family);
		}
		// If the address is local, make and pass an error:
		return callback(new LocalIPBlockedError(hostname));
	});
}

/** Designed to mimic the return value of http.get. */
function makeFakeErrorEventEmitter(host) {
	return {
		on(eventName, errCallback) {
			if (eventName !== 'error') {
				throw new Error('This is a fake event emitter. Please only listen for the "error" event.');
			}
			errCallback(new LocalIPBlockedError(host));
		},
	};
}

const protocolToGet = {
	'http:': getHttp,
	'https:': getHttps,
};
/**
 * Calls http.get or https.get depending on the protocol of the given URL.
 * If the given URL is a local IP, or resolves to a local IP (i.e. not in the
 * unicast IP range), no request to it is made and an error event is emitted.
 * @param {string|URL} url
 * @param {function} callback
 * @returns {ClientRequest|object} If the url is a local IP address, an object
 * with an `on` method which, if called as `on('error', callback)` will call
 * the callback with a LocalIPBlockedError. Otherwise, the ClientRequest object
 * returned by the call to http/https.get.
 */
function getHttpOrHttps(url, callback) {
	// Note: url.urlToHttpOptions is used here as it automatically strips the
	// square brackets [] from IPv6 addresses. This is necessary for net.isIP to
	// properly recognize the host as an IP address.
	const parsedUrl = urlToHttpOptions(new URL(url));
	const host = parsedUrl.hostname;

	// Check if the host is a a local IP address, and provoke an error if so.
	// This is necesssary because, when the host is an IP, the DNS lookup is
	// skipped, so we have to block the request before it's even made:
	// https://github.com/nodejs/node/blob/adaf60240559ffb58636130950262ee3237b7a41/lib/net.js#L1047
	if (isIP(host) && ipaddr.parse(host).range() !== 'unicase') {
		return makeFakeErrorEventEmitter(host);
	}
	const protocol = parsedUrl.protocol;
	const get = protocolToGet[protocol];
	if (get === undefined) {
		return null;
	}
	// Prevent requests to local addresses, such as localhost:
	const options = { lookup: blockLocalLookup };
	return get(url, options, callback);
}

/**
 * Helper function for fetchInitialResponse
 * @param {string} url The URL to make a request to
 * @param {function} onResponse A callback called when a response other than a
 * Node request error is received (HTTP errors like 404 will still get passed to
 * this callback).
 * @param {function} onError A callback called when a Node request error is
 * received.
 * @param {object} [options]
 * @param {boolean} [options.retryOnECONNRESET=false] If true, automatically
 * retry requests which result in ECONNRESET errors (which are usually transient
 * and just caused by bad request timing). If false, requests are not retried.
 * @param {number} [options.numRetries=0] The current retry count. Used for the
 * recursive call.
 * @param {number} [options.maxRetries=15] The maximum number of attempts to
 * reconnect to the given URL if an ECONNRESET error occurs.
 * @param {number} [options.retryDelayFactorMS=100] The base amount of time in
 * milliseconds to wait between request retries.
 * @param {number} [options.retryDelayExponentialBase=2] Each time a request is
 * retried, the next retry must take this many times longer. For a value of 2,
 * the delay doubles each time (100ms, 200ms, 400ms, etc.).
 * @returns {void}
 */
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
		return;
	}
	if (!retryOnECONNRESET) {
		req.on('error', onError);
		return;
	}
	req.on('error', async err => {
		// Check if retry is needed
		if (err.code === 'ECONNRESET') {
			await wait(retryDelayFactorMS * retryDelayExponentialBase ** numRetries);
			++numRetries;
			console.error(`Retrying network request to ${url} due to ECONNRESET at (attempt ${numRetries})...`);
			retriableRequest(url, onResponse, onError, {
				retryOnECONNRESET: (numRetries < maxRetries),
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

export function fetchInitialResponse(url, {
	retryOnECONNRESET = false,
	maxRetries = 15,
	retryDelayFactorMS = 100,
	retryDelayExponentialBase = 2,
} = {}) {
	const responseHandler = resolve => response => {
		// Necessary to consume the response stream and allow it to close:
		// See https://nodejs.org/api/http.html#class-httpclientrequest from "If no
		// response handler is added[...]"
		response.resume();

		response.on('end', () => {
			if (!response.complete) {
				console.error(`The request to ${url} was terminate while the message was still being sent.`);
			}
		});

		// Simply resolve as soon as the initial response is received, and allow the
		// `end` event handler to run in the background.
		resolve(response);
	};

	return new Promise((resolve, reject) => {
		retriableRequest(url, responseHandler(resolve), reject, {
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
			const response = await fetchInitialResponse(url, {
				retryOnECONNRESET: true,
			});
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
				const retryDelayMS = Math.min(100, getRetryAfterMS(response));
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
		response = await fetchInitialResponse(url, {
			retryOnECONNRESET: true,
		});
	}
	catch (httpsError) {
		throw httpsError.code;
	}
	return response.statusCode;
}