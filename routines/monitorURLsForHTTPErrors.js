const { fetchStatusCode } = require('../util/fetchStatusCode');
const { getEnabledUrlObjsForGuild, setUrlsEnabled } = require('../util/manageUrlsDB');

async function sendMessageToGuildChannel({
	guild,
	channelId,
	content,
} = {}) {
	const channel = await guild.channels.fetch(channelId);
	return channel.send({ content });
}

// Check the status codes for all of the URLs stored in the DB for the given
// guild. Then, if any of them are error codes, send a message to the
// corresponding channel.
async function reportStatusCodesForGuild(client, guildId) {
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
module.exports = {
	name: 'monitorURLsForHTTPErrors',
	interval_ms: 5 * MS_PER_MIN, // 5 minutes
	async execute(client) {
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
	},
	reportStatusCodesForGuild,
};