import { fetchResponseChain, testUrl } from '../util/fetchStatusCode.mjs';
import { getEnabledUrlObjsForGuild, setUrlsEnabled } from '../util/manageMonitoredURLs.mjs';

async function sendMessageToGuildChannel({
	guild,
	channelId,
	content,
} = {}) {
	const channel = await guild.channels.fetch(channelId);
	return await channel.send({ content });
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
 * @param {(string | UrlObj)[]} urlObjs An array of url strings or UrlObjs to
 * check
 * @param {Object} options
 * @param {boolean} [options.errorsOnly=false] If true, include lines only for
 * urls which result in an error. Otherwise, include a line for all urls. If
 * true and no urls result in an error, a special-case message is returned.
 * @returns {Promise<string>} A string message with a human-readable line for
 * each urlObj giving information about the response received from that url.
 */
export async function getReportStr(urlObjs, { errorsOnly = false } = {}) {
	if (urlObjs.length === 0) {
		return 'No URLs were given to be tested';
	}
	const urls = urlObjs.map(o => (typeof o === 'string') ? o : o.url);
	const testResults = await Promise.all(urls.map(testUrl));

	const outLines = [];

	for (const result of testResults) {
		const url = result.startUrl;
		const escapedURL = '`' + url.replaceAll('`', '\\`') + '`';

		// A resolved promise indicates that a response was received, but that
		// response may have been an HTTP error, so filter out acceptable status
		// codes:
		let line = `• ${escapedURL} `;
		if (result.isRedirect) {
			const escapedEndURL = '`' + result.endUrl.replaceAll('`', '\\`') + '`';
			line += `redirects to ${escapedEndURL} which `;
		}
		if (result.isOK) {
			if (errorsOnly) {
				// If the errorsOnly option is truthy, do not include a line for URLs
				// which end in an OK result:
				continue;
			}
			line += 'is OK.';
		}
		else if (result.endStatusCode) {
			line += `results in an HTTP ${result.endStatusCode} error.`;
		}
		else {
			line += `results in a "${result.nodeError}" Node request error.`;
		}
		outLines.push(line);
	}
	if (outLines.length === 0) {
		return 'No HTTP errors were found for any of the given URLs';
	}
	return outLines.join('\n');
}

// Check the status codes for all of the URLs stored in the config for the given
// guild. Then, if any of them are error codes, send a message to the
// corresponding channel.
export async function reportStatusCodesForGuild(client, guildId) {
	const urlObjs = await getEnabledUrlObjsForGuild(guildId);
	if (!urlObjs) {
		return null;
	}
	const urls = urlObjs.map(o => o.url);
	const responsePromises = urls.map(fetchResponseChain);
	const responseChains = await Promise.all(responsePromises);

	const errorsPerChannel = Object.create(null);
	let anyErrors = false;

	const urlsToDisableSet = new Set();

	for (let i = 0, len = responseChains.length; i < len; ++i) {
		const chain = responseChains[i];
		const url = urls[i];
		const chainLen = chain.length;
		const endResponse = chain[chainLen - 1];

		let errorDescription;

		const httpResponseCode = endResponse.result;
		// An OK HTTP response, indicating the final result is valid:
		if (httpResponseCode === 200) {
			continue;
		}
		else if (typeof httpResponseCode === 'number') {
			// HTTP Errors (e.g. 404 Not Found):
			errorDescription = `an HTTP ${httpResponseCode} error`;
		}
		// Node request errors (as opposed to HTTP errors):
		else if (httpResponseCode === 'ENOTFOUND') {
			errorDescription = 'an invalid URL (no response)';
		}
		else {
			errorDescription = `a "${httpResponseCode}" Node request error`;
		}

		// Prevent this URL from being checked for errors again until it is
		// re-enabled via the /http-monitor re-enable command:
		urlsToDisableSet.add(url);

		anyErrors = true;
		const urlObj = urlObjs[i];
		const notifyChannels = urlObj.notifyChannels;


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
	const messageResults = await Promise.allSettled(messagePromises);
	for (const result of messageResults) {
		if (result.status === 'fulfilled') {
			continue;
		}
		console.log(`reportStatusCodesForGuild failed to send a message in guild ${guildId} at ${Date()}.`);
	}
	return;
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
	return await Promise.all(reportPromises);
}