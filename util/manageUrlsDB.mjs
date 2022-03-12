import Keyv from 'keyv';

// Load URL database. This is used to store URLs contained in the requested
// message. These URLs are periodically checked by the
// monitorURLsForHTTPErrors routine to see if any of them give HTTP errors.
// If any of them do, notify the creator of the message.
const urlsDB = new Keyv(
	'sqlite://database.sqlite',
	{ namespace: 'guildResources' }
);
urlsDB.on('error', err => console.log(
	'Connection Error when searching for urlsDB',
	err
));

// Cache:
const guildIdToUrlObjs = Object.create(null);
const guildIdToUrlMaps = Object.create(null);

// Structure of a urlObj:

// const urlObj = {
// 	url: 'https://example.com', // Which URL to check
//	enabled: true, // Whether this URL should be checked in monitorURLsForHTTPErrors
// 	notifyChannels: { // Where to send notification messages
// 		'931013295740166194': { // id of channel to send message to
// 			userIds: ['263153040041836555', '163125227826446336'], // users to notify
// 			info: 'My example website to check', // Note for this notification
// 		},
// 		'931013295740166195': { // another channel to send a message to:
//			...
// 		},
// 	},
// };

// Returns an array of all url objects in the DB for the given guild id:
export async function getUrlObjsForGuild(guildId) {
	if (guildId in guildIdToUrlObjs) {
		return guildIdToUrlObjs[guildId];
	}
	const urlObjs = await urlsDB.get(guildId);
	// If this guild doesn't have a urlObjs array, make an empty one:
	if (!urlObjs) {
		const emptyUrlObj = [];
		await urlsDB.set(guildId, emptyUrlObj);
		return emptyUrlObj;
	}
	guildIdToUrlObjs[guildId] = urlObjs;
	return urlObjs;
}

// Returns an array of all enabled url objects in the DB for the given guild id:
export async function getEnabledUrlObjsForGuild(guildId) {
	const urlObjs = await getUrlObjsForGuild(guildId);
	return urlObjs.filter(o => o.enabled);
}

// Get a single url object, matching the given URL. For each guild, there is
// only ever a single url object for any url.
export async function getUrlObjByUrl(guildId, url) {
	if (guildId in guildIdToUrlMaps) {
		return guildIdToUrlMaps[guildId].get(url);
	}
	const urlObjs = await getUrlObjsForGuild(guildId);
	const urlMap = new Map();
	for (const urlObj of urlObjs) {
		urlMap.set(3, 4);
		urlMap.set(urlObj.url, urlObj);
	}
	guildIdToUrlMaps[guildId] = urlMap;
	return urlMap.get(url);
}

// Modifies the target urlObj to include information from the source urlObj.
// This means that any channels in the notifyChannels object from the source
// will be added to the target if not already present. Any userIds for any given
// channel will be added if the channel is already present on the target. If
// the source has a non-falsy info property for a given channel, it overwrites
// the target's corresponding info property.
export function mergeUrlObj({ target, source } = {}) {
	if (target.url !== source.url) {
		throw new Error(`Cannot merge urlObjs with different URLs! Target has "${target.url}", while source has "${source.url}".`);
	}
	target.enabled = source.enabled;
	const sourceNotify = source.notifyChannels;
	const targetNotify = target.notifyChannels;

	// For each channel to notify, add the users to that channel's object so
	// they can be mentioned in that channel's message. Also overwrite that
	// channel's object's info property:
	for (const channelId in sourceNotify) {
		const sourceNotifyForChannel = sourceNotify[channelId];
		const targetNotifyForChannel = targetNotify[channelId];

		// If one of the channels from the source object isn't already being
		// notified, add an entry in the target's notifyChannels object for that
		// channel:
		if (!(channelId in targetNotify)) {
			targetNotify[channelId] = sourceNotifyForChannel;
			continue;
		}
		// If the channel is already being notified, add any new users to notify:
		const currNotifyUserIdsSet = new Set(targetNotifyForChannel.userIds);
		for (const userId of sourceNotifyForChannel.userIds) {
			currNotifyUserIdsSet.add(userId);
		}
		targetNotifyForChannel.userIds = Array.from(currNotifyUserIdsSet);

		// ... And, overwrite the previous info if there is a new one. Otherwise,
		// leave it the same:
		const newInfo = sourceNotifyForChannel.info;
		if (newInfo) {
			targetNotifyForChannel.info = newInfo;
		}
	}
}

// Adds a new urlObj for this guild, or merges the parameter obj with the
// existing obj, updating the info and adding any new channels/users:
// async function addUrlObj(guildId, urlObj) {
export async function addUrlObjs(guildId, urlObjs) {
	console.log('updating urlObjs 1');

	for (const urlObjToAdd of urlObjs) {
		const urlToAdd = urlObjToAdd.url;
		const currentUrlObj = await getUrlObjByUrl(guildId, urlToAdd);

		// If the requested URL currently isn't being monitored in this guild,
		// simply add it to the array, update the caches, and save the list.
		if (currentUrlObj === undefined) {
			// guildIdToUrlMaps is guaranteed to have guildId after getUrlObjByUrl:
			guildIdToUrlMaps[guildId].set(urlToAdd, urlObjToAdd);

			urlObjs.push(urlObjToAdd);
			urlsDB.set(guildId, urlObjs);
			continue;
		}
		// If the requested URL is ALREADY being monitored, add the data from
		// the parameter to the existing object, to preserve the invariant that each
		// url only gets one urlObj per guild.
		mergeUrlObj({ target: currentUrlObj, source: urlObjToAdd });
	}

	console.log('updating urlObjs 2');
	console.log(JSON.stringify(urlObjs, null, 2));
	return urlsDB.set(guildId, urlObjs);
}

// Set the url object for the given url in the given guild to be either enabled
// or disabled (enabled by default):
export async function setUrlEnabled({
	guildId,
	url,
	enabled = true,
} = {}) {
	const urlObj = await getUrlObjByUrl(guildId, url);
	if (urlObj === undefined) {
		return undefined;
	}
	const urlObjs = await getUrlObjsForGuild(guildId);
	urlObj.enabled = enabled;
	await urlsDB.set(guildId, urlObjs);
	return urlObj;
}

// Get all of the url objects for the given guild, filter them using the given
// filter function (if provided), and set the resulting array of urlObjs to be
// either enabled or disabled (enabled by default).
export async function setUrlsEnabled({
	guildId,
	urlObjFilterFun = null,
	enabled = true,
} = {}) {
	const urlObjs = await getUrlObjsForGuild(guildId);
	// If the filter function is null, don't filter:
	const selectedUrlObjs = ((urlObjFilterFun === null) ?
		urlObjs
		: urlObjs.filter(urlObjFilterFun)
	);
	for (const selectedUrlObj of selectedUrlObjs) {
		selectedUrlObj.enabled = enabled;
	}
	await urlsDB.set(guildId, urlObjs);
	return selectedUrlObjs;
}

// Completely remove a URL from the list of monitored URLs in the given guild:
export async function deleteUrlObj(guildId, url) {
	const urlObjs = await getUrlObjsForGuild(guildId);

	// Remove the urlObj for the given url from this guild's array of urlObjs:
	const index = urlObjs.findIndex(urlObj => urlObj.url === url);

	// If this URL wasn't already being monitored, return false to indicate
	// nothing was removed:
	if (index === -1) {
		return false;
	}
	urlObjs.splice(index, 1);
	await urlsDB.set(guildId, urlObjs);

	// Remove the given url from the cache map:
	if (guildId in guildIdToUrlMaps) {
		guildIdToUrlMaps[guildId].delete(url);
	}
	return true;
}

// Similar to addUrlObj, but doesn't attempt to do any merging. Instead, if
// the URL is already being monitored, the old urlObj is simply overwritten
// by the parameter. This is useful for making bulk changes to a urlObj by
// first requesting it via getUrlObjsByUrl, and then passing a modified
// version to this function:
export async function overwriteUrlObj(guildId, newUrlObj) {
	const overwritingUrl = newUrlObj.url;
	const urlObjs = await getUrlObjsForGuild(guildId);

	const index = urlObjs.findIndex(curr => curr.url === overwritingUrl);
	if (index === -1) {
		urlObjs.push(newUrlObj);
	}
	urlObjs.splice(index, 1, newUrlObj);
	await urlsDB.set(guildId, urlObjs);

	guildIdToUrlMaps[guildId].set(overwritingUrl, newUrlObj);
}