import { fetchResponseChain, fetchStatusCode } from '../util/fetchStatusCode.mjs';
import { getEnabledUrlObjsForGuild, setUrlsEnabled } from '../util/manageMonitoredURLs.mjs';

async function sendMessageToGuildChannel({
	guild,
	channelId,
	content,
} = {}) {
	const channel = await guild.channels.fetch(channelId);
	return channel.send({ content });
}

/**
 * @typedef {Object} NotifyChannelInfo An object storing information about the
 * notification to send to a given channel
 * @prop {string[]} userIds Which users to notify in the given channel
 * @prop {string} [info] An optional extra message to include with notifications
 *
 * @typedef {Object} UrlObj An object storing information about a URL being
 * monitored by AutoRide via the monitorURLsForHTTPErrors routine.
 * @prop {string} url The URL being monitored
 * @prop {boolean} enabled Whether the URL is currently being monitored. If
 * false, monitoring is temporarily disabled for the url until re-enabled via
 * the http-monitor re-enable command
 * @prop {Object.<string, NotifyChannelInfo>} notifyChannels An object
 * mapping from channel Ids to objects containing information about the
 * notification message to send to that channel in the event of an error.
 */

/**
 * Similar to reportStatusCodesForGuild, except it directly takes an array of
 * urlObjs and returns a string summarizing both the normal responses and the
 * errors, ignoring the notifyChannels property.
 *
 * @param {(string | UrlObj)[]} urlObjs An array of url strings or UrlObjs to check
 * @param {Object} options
 * @param {boolean} [options.errorsOnly=false] If true, include lines only for
 * urls which result in an error. Otherwise, include a line for all urls. If
 * true and no urls result in an error, a special-case message is returned.
 * @returns {Promise<string>} A string message with a human-readable line for each urlObj
 * giving information about the response received from that url.
 */
export async function getReportStr(urlObjs, { errorsOnly = false } = {}) {
	if (urlObjs.length === 0) {
		return 'No URLs were given to be tested';
	}
	const urls = urlObjs.map(o => (typeof o === 'string') ? o : o.url);
	const responsePromises = urls.map(fetchResponseChain);
	const responseChains = await Promise.all(responsePromises);

	const outLines = [];

	for (let i = 0, len = responseChains.length; i < len; ++i) {
		const chain = responseChains[i];
		const url = urls[i];
		const escapedURL = '`' + url.replaceAll('`', '\\`') + '`';

		// A resolved promise indicates that a response was received, but that
		// response may have been an HTTP error, so filter out acceptable status
		// codes:
		let line = `• ${escapedURL} `;
		const chainLen = chain.length;
		const endResponse = chain[chainLen - 1];
		if (chainLen > 1) {
			const endURL = endResponse.url;
			line += `redirects to ${'`' + endURL.replaceAll('`', '\\`') + '`'} which `;
		}
		const httpResponseCode = endResponse.result;
		if (httpResponseCode === 200) {
			if (errorsOnly) {
				// If the errorsOnly option is truthy, do not include a line for URLs
				// which end in an OK result:
				continue;
			}
			line += 'is OK.';
		}
		else if (typeof httpResponseCode === 'number') {
			line += `results in an HTTP ${httpResponseCode} error.`;
		}
		else {
			line += `results in a "${httpResponseCode}" Node request error.`;
		}
		outLines.push(line);
	}
	if (outLines.length === 0) {
		return 'No HTTP errors were found for any of the given URLs';
	}
	return outLines.join('\n');
}

// @TODO Fix this to use fetchResponseChain instead!!! This currentlywon't check if a
// redirect leads to a 404!!!
// Check the status codes for all of the URLs stored in the config for the given
// guild. Then, if any of them are error codes, send a message to the
// corresponding channel.
export async function reportStatusCodesForGuild(client, guildId) {
	const urlObjs = await getEnabledUrlObjsForGuild(guildId);
	if (!urlObjs) {
		return null;
	}

	const statusCodePromises = urlObjs.map(obj => fetchStatusCode(obj.url));
	const statusResults = await Promise.allSettled(statusCodePromises);
	const errorsPerChannel = Object.create(null);
	let anyErrors = false;

	const urlsToDisableSet = new Set();

	// For every URL for this guild, find all of them which resulted in some kind
	// of error upon HTTPS request. Store some information about each such
	// URL/error, so that report messages can be sent later:
	for (let i = 0, len = statusResults.length; i < len; ++i) {
		const statusResult = statusResults[i];
		let errorDescription;

		// A resolved promise indicates that a response was received, but that
		// response may have been an HTTP error, so filter out acceptable status
		// codes:
		if (statusResult.status === 'fulfilled') {
			const httpResponseCode = statusResult.value;
			// 200 "OK" is a normal response. 301 "Moved Permanently", 302 "Moved
			// Temporarily" and 303 "See Other" are basic redirects.
			if ([200, 301, 302, 303].includes(httpResponseCode)) {
				continue;
			}
			errorDescription = `an HTTP ${httpResponseCode} error`;
		}
		// If a promise didn't resolve, it must have rejected due to an error event
		// on the https request object in fetchStatusCode:
		else {
			const errorCode = statusResult.reason;
			if (errorCode === 'ENOTFOUND') {
				errorDescription = 'an invalid URL (no response)';
			}
			else {
				errorDescription = `a "${errorCode}" Node request error`;
			}
		}
		// If the request rejected (e.g. due to getting no response from the URL) or
		// received an http error response, log info about it:
		anyErrors = true;
		const urlObj = urlObjs[i];
		const url = urlObj.url;
		const notifyChannels = urlObj.notifyChannels;

		// Prevent this URL from being checked for errors again until it is
		// re-enabled via the /http-monitor re-enable command:
		urlsToDisableSet.add(url);

		// For all of the channels that this urlObj stores in its notifyChannels
		// object, add some information to the errorsPerChannel object so messages
		// can be sent once all the urls have been checked:
		for (const channelId in notifyChannels) {
			const errorData = {
				errorDescription,
				url,
				...notifyChannels[channelId],
			};
			if (channelId in errorsPerChannel) {
				errorsPerChannel[channelId].push(errorData);
				continue;
			}
			errorsPerChannel[channelId] = [errorData];
		}
	}
	if (!anyErrors) {
		return null;
	}
	// Save the fact that URLs which gave errors had their enabled property set to
	// false to prevent them from being checked again until they're re-enabled
	// via the /http-monitor re-enable command:
	await setUrlsEnabled({
		guildId,
		urlObjFilterFun(urlObjToDisable) {
			return urlsToDisableSet.has(urlObjToDisable.url);
		},
		enabled: false,
	});

	// Send messages:
	const messagePromises = [];
	const guild = await client.guilds.fetch(guildId);
	for (const channelId in errorsPerChannel) {
		const errors = errorsPerChannel[channelId];
		const errorStr = (errors
			.map(e => `• ${e.url}${(e.info) ? ` (${e.info})` : ''} results in ${e.errorDescription}.`)
			.join('\n')
		);
		const mentionsSet = new Set();
		for (const error of errors) {
			for (const userId of error.userIds) {
				mentionsSet.add(`<@${userId}>`);
			}
		}
		const mentions = Array.from(mentionsSet);
		const mentionPrefix = (mentions.length > 0) ? `${mentions.join(', ')}: ` : '';
		messagePromises.push(sendMessageToGuildChannel({
			guild,
			channelId,
			content: `${mentionPrefix}The following monitored URL(s) return the given errors:\n${errorStr}\n**NOTE**: These URLs won't be checked again until you manually re-enable them using the \`/http-monitor re-enable\` command`,
		}));
	}
	return Promise.all(messagePromises);
}

const MS_PER_MIN = 60 * 1000;
export const name = 'monitorURLsForHTTPErrors';
export const interval_ms = 5 * MS_PER_MIN; // 5 minutes
export async function execute(client) {
	const guilds = client.guilds;
	const reportPromises = [];
	for (const guildId of guilds.cache.keys()) {
		const thisGuildPromise = reportStatusCodesForGuild(client, guildId);

		// If this guild didn't have any URLs to monitor, or if none of them gave
		// errors:
		if (thisGuildPromise === null) {
			continue;
		}
		reportPromises.push(thisGuildPromise);
	}
	return Promise.all(reportPromises);
}