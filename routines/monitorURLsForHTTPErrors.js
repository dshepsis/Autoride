const { fetchStatusCode } = require('../util/fetchStatusCode');
const Keyv = require('keyv');

// Load URL database. The keys are guild ids, mapping to arrays of objects
// which contain information about URLs to check:
const urlsDB = new Keyv(
	'sqlite://database.sqlite',
	{ namespace: 'guildResources' }
);
urlsDB.on('error', err => console.log(
	'Connection Error when searching for urlsDB',
	err
));

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
	// @TODO: Maybe there should be some additional metadata here, to support
	// preventing multiple urlObjs having the same URL...
	const urlObjs = await urlsDB.get(guildId);
	if (!urlObjs) {
		return null;
	}
	// a urlObj has the properties url, channelId, and optionally info, userId,
	// and enabled.
	// info is a short string giving context to the URL (e.g. "OBS Studio").
	// userId is the ID of a user to mention in the warning.
	// enabled is a boolean. If it's truthy (or undefined), the given url is
	//   checked. If it's falsy, the url is not checked and errors won't be
	//   reported. This is used to prevent repeatedly sending out messages for the
	//   same error.
	const statusCodePromises = [];
	for (const urlObj of urlObjs) {
		// Don't check disabled URLs:
		if (!urlObj.enabled) {
			continue;
		}
		statusCodePromises.push(fetchStatusCode(urlObj.url));
	}
	const statusResults = await Promise.allSettled(statusCodePromises);
	const errorsPerChannel = Object.create(null);
	let anyErrors = false;
	for (let i = 0, len = statusResults.length; i < len; ++i) {
		const statusResult = statusResults[i];
		let errorDescription;

		if (statusResult.status === 'resolved') {
			// 200 "OK" is a normal response. 301 "Moved Permanently", 302 "Moved
			// Temporarily" and 303 "See Other" are basic redirects.
			const httpResponseCode = statusResult.value;
			if (['200', '301', '302', '303'].includes(httpResponseCode)) {
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
		// If the request rejected (e.g. due to getting no response from the URL or
		// receiving an http error response), log it:
		anyErrors = true;
		const urlObj = urlObjs[i];

		// Prevent this URL from being checked for errors again until it is
		// re-enabled via the /http-monitor re-enable command:
		urlObj.enabled = false;
		const channelId = urlObj.channelId;
		const errorData = {
			errorDescription,
			...urlObj,
		};
		if (channelId in errorsPerChannel) {
			errorsPerChannel[channelId].push(errorData);
			continue;
		}
		errorsPerChannel[urlObj.channelId] = [errorData];
	}
	if (!anyErrors) {
		return null;
	}
	// Save the fact that URLs which gave errors had their enabled property set to
	// false to prevent them from being checked again before being re-enabled
	// via the /http-monitor re-enable command:
	await urlsDB.set(guildId, urlObjs);

	// Send messages:
	const messagePromises = [];
	const guild = await client.guilds.fetch(guildId);
	for (const channelId in errorsPerChannel) {
		const errors = errorsPerChannel[channelId];
		const errorStr = (errors
			.map(e => `• ${e.url}${(e.info) ? ` (${e.info})` : ''} results in ${e.errorDescription}.`)
			.join('\n')
		);
		const mentions = [];
		for (const error of errors) {
			if (error.userId) {
				mentions.push(`<@${error.userId}>`);
			}
		}
		const mentionPrefix = `${(mentions.length > 0) ? `${mentions.join(', ')}: ` : ''}`;
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
	interval_ms: 5 * MS_PER_MIN, // 5 minutes
	async execute(client) {
		// Returns an array of objects containing information for every resource which,
		// when an HTTPS request was made against its link property, an HTTP response
		// code other than 200 "OK" was received:
		const guilds = client.guilds;
		const reportPromises = [];
		for (const guildId of guilds.cache.keys()) {
			const thisGuildPromise = reportStatusCodesForGuild(client, guildId);
			if (thisGuildPromise === null) {
				continue;
			}
			reportPromises.push(thisGuildPromise);
		}
		return Promise.all(reportPromises);
	},
};