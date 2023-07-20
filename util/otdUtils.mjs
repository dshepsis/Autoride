import { EmbedBuilder } from 'discord.js';

import { makeDefault } from '../guild-config-schema/onThisDay.mjs';
import * as guildConfig from './guildConfig.mjs';

import { splitMessageRegex } from '../util/splitMessageRegex.mjs';

import { pkgRelPath } from './pkgRelPath.mjs';
import { importJSON } from './importJSON.mjs';
const {
	guildIds: configGuildIds,
	developmentGuildId,
} = await importJSON(pkgRelPath('./config.json'));
const allGuildIds = [developmentGuildId, ...configGuildIds];

/**
 * Types:
 * @typedef { import('../guild-config-schema/onThisDay.mjs').OTDConfig } OTDConfig
 * @typedef { import("discord.js").Client } DJSClient
 * @typedef { import("discord.js").BaseGuildTextChannel } BaseGuildTextChannel
 * @typedef { import("discord.js").Message } Message
 */

/**
 * @param {string} guildId The Discord snowflake for the guild
 * @returns {Promise<OTDConfig>} The OTD Config object for the given guild, or
 * an empty data structure which matches the OTD config schema
 */
async function getOTDConfig(guildId) {
	const guildOTDConfig = await guildConfig.get(guildId, 'onThisDay');
	if (guildOTDConfig === undefined) {
		return makeDefault();
	}
	return guildOTDConfig;
}
/**
 * @param {string} guildId The Discord snowflake for the guild
 * @param {OTDConfig} guildOTDConfig An OTD Config object to write for the
 * given guild.
 * @returns {Promise<true>}
 */
async function setOTDConfig(guildId, guildOTDConfig) {
	return await guildConfig.set(guildId, 'onThisDay', guildOTDConfig);
}

/**
 * Returns a human-readable string date based on the given date parameter,
 * including the year
 * @param {Date} dateObj A JS Date object
 * @returns {string} A human-readable text representation of the date
 */
export const formatFullDate = (() => {
	const formatter = new Intl.DateTimeFormat('en-GB', {
		day: '2-digit', month: 'long', year: 'numeric',
	});
	return function(dateObj) {
		return formatter.format(dateObj);
	};
})();
/**
 * Returns a human-readable string date based on the given date parameter,
 * excluding the year
 * @param {Date} dateObj A JS Date object
 * @returns {string} A human-readable text representation of the date
 */
export const formatDateNoYear = (() => {
	const formatter = new Intl.DateTimeFormat('en-GB', {
		day: '2-digit', month: 'long',
	});
	return function(dateObj) {
		return formatter.format(dateObj);
	};
})();

/**
 * Gets an array of events from the guild's "onThisDay" guild-config file that
 * are within the same day/month/year as the given date parameter. If no date
 * and scope are provided, the full list of all events are provided. Events
 * will always be sorted in ascending order of month-day-year.
 * @param {string} guildId The guild for which this event applies
 * @param {object} [options] Optional. Object with a `scope` and `dateObj`
 * property. Used to restrict what events are returned. If omitted, all events
 * for this guild are returned.
 * @param {"day"|"month"|"year"|"dayAllYears"} [options.scope] In what range of
 * time surrounding the options.dateObj parameter to look for events.
 * @param {Date} [options.dateObj] The date object around which to look for
 * events. The extent to which to search is based on the options.scope
 * parameter, which is required if this is specified.
 * @returns {Promise<{date: Date, event: string}[]>} An array of objects with
 * js Date properties and an event description string
 */
export async function getOTDEvents(guildId, { scope, dateObj } = {}) {
	const guildOnThisDay = (
		await getOTDConfig(guildId)
        ?? makeDefault()
	);
	if (scope === undefined) {
		if (dateObj !== undefined) {
			throw new Error('dateObj option is specified, but scope is not. Please specify both or neither.');
		}
	}
	else if (dateObj === undefined) {
		throw new Error('scope option is specified, but dateObj is not. Please specify both or neither.');
	}
	const eventList = [];
	for (let monthIndex = 0; monthIndex < 12; ++monthIndex) {
		if (
			['day', 'month', 'dayAllYears'].includes(scope)
			&& dateObj.getMonth() !== monthIndex
		) {
			continue;
		}
		const monthObj = guildOnThisDay.events[monthIndex];
		for (const dayOfMonthStr in monthObj) {
			if (
				['day', 'dayAllYears'].includes(scope)
				&& dateObj.getDate() !== +dayOfMonthStr
				|| dayOfMonthStr === 'month'
			) {
				continue;
			}
			const dayObj = monthObj[dayOfMonthStr];
			for (const yearStr in dayObj) {
				if (
					['day', 'month', 'year'].includes(scope)
					&& dateObj.getFullYear() !== +yearStr
				) {
					continue;
				}
				for (const event of dayObj[yearStr]) {
					const date = new Date(+yearStr, monthIndex, +dayOfMonthStr);
					const eventObj = { date, event };
					eventList.push(eventObj);
				}
			}
		}
	}
	return eventList;
}

/**
 * Returns an array of 3 RGB values in the range of [0, 255], which change
 * based on the date. The purpose of this is to give on-this-day announcement
 * embed messages a unique border color every day.
 * @param {Date} dateObj The day of the announcement
 * @returns {[number, number, number]} A triple of integers between 0 and 255
 * (inclusive), representing the RGB components of a color.
*/
function dateToBorderColor(dateObj) {
	// Start by calculating HSL. The hue cycles through the rainbow each year.
	// The saturation cycles up and down between 60% and 100% in a 12 year
	// cycle, being at 100% on each year of the dog. The lightness remains
	// constant at 66%.
	const year = dateObj.getFullYear();
	const startOfDay = new Date(year, dateObj.getMonth(), dateObj.getDate());
	const startOfYear = new Date(year, 0, 1);
	const MS_PER_DAY = 1000 * 60 * 60 * 24;
	const yearLen = (new Date(year + 1, 0, 1) - startOfYear) / MS_PER_DAY;
	const timeSinceNewYear = Math.round((startOfDay - startOfYear) / MS_PER_DAY);

	// Approximate average 0-based Julian date of Chinese New Year. This is
	// used so that the color is most red around CNY.
	const MEAN_CNY_DAY = 35;

	let hue = (timeSinceNewYear - MEAN_CNY_DAY) / yearLen;
	hue = hue % 1;
	if (hue < 0) {
		hue += 1;
	}

	const sat = 0.8 + 0.2 * Math.cos((year - 2006) * Math.PI / 6);
	const light = 0.66;

	// Convert HSL to RGB:
	function f(n) {
		const k = (n + hue * 12) % 12;
		const a = sat * Math.min(light, 1 - light);
		const rgbFrac = light - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
		return Math.round(255 * rgbFrac);
	}
	return [f(0), f(8), f(4)];
}

/**
 * @type{string[]} URLs of icons taken from Steam's achievements, used for
 * embed icons.
 */
const steamAchievementIconURLs = [
	'844f0c7d702ece058eba88de82ad980d79af2e7f',
	'ddb9c92aa730767a6c6203bc067dd73fce90d717',
	'97f50cd969b297d57e8dd6d27f58eff749c4e5e0',
	'ff6a01472b7bb1973aad6d1df4537a00fa8bae42',
	'ec47bcd29baa97aea991c16df53617f77ea6d75d',
	'40b5e51421dad65be586ae2fc9c9edc7587876a0',
	'fe809c54adbc411042b82bcb2a40facdfa6ce6a1',
	'cb598e661e3bbd815893d7b5d2bd6746a890362f',
	'82afb7d5f9dbf32197777cb64236be744aec776b',
	'fba65e0d98a2b2d4fafcc5e492daa6ef265a8051',
	'af10e5dd90597257f2daabebd220ef60e8863ca3',
	'b3abac7aa79b7cbdb4d08c996c92fe210fb756f3',
	'8af2750e7a1ca353587a256c2257f39f5ad8952d',
	'96ff2ef7d91aad8ed4d0db8abb4a74af62e6860e',
	'26ad70169b89031244019b6ba72adf757f5021dd',
	'740ba025a56036492813d611ac702eff7aa7c6ce',
	'27c8a104143e7251a9b8e22d0ab0c1fbce5a80f4',
	'5a3f8f36afe4887f8182b76724c0a6cea59165dc',
	'e4bb4266fc2d573604dcdb08736dbbcd54147b60',
	'1b7be81c30b242c612b4892722a982f23758b88f',
	'b350916b1b9662c7c197e862313d35f5ce96a59b',
	'353523c90ec1cd0d71db58472bcbd866083ddfbd',
	'4af21fa8cc78783120fc18d8a08e71608764b037',
	'dd74c8d8f0cf2bf9905b031746b6936b1bfc46c3',
	'9951c80c55296c4b37eb9b9b772be0afafa60690',
	'03aae12c9cc6e742ef3c72976eec0d454a93a8b9',
	'c66c68fd816b2c3290f3228ad6038e9bcb34b37d',
	'4c03a7215652efda87c2a09b52421a8eb739ee88',
	'01912676e5ef70be71515ef3c3f886989128e7e4',
	'f55a2d75534b5711d323285b7f14bbd1e8b96566',
	'25e54117ea85a34b2f6c7791ca8d0b1a0dccc525',
	'91251c45522f6838e90bd28505c0fd1dc4cabcfc',
	'a72a47d43d5b52f14811c34ebccba6433b8e18bf',
	'53386417e9af6f1ea5ac0e9b59ffd39a324aa8e0',
	'e9e6b050ec0297b69ae6050e6978f5dff2656620',
	'bc4ba7703e4855c7080c19e9443dbbcdae710a38',
	'7933737d4b9720a8c99e2d6a61b6b700cb75fce3',
	'8152f8ccdd81c441c5913c530d6b9872574a7276',
	'6ee5c2d96dd59fab523861a5c5d59955fbcefd71',
	'39bfcd19320a068775fdb52238ad48ee1d2fc92a',
	'c4e1033daee5c227f55b2225affe92597314a633',
	'52d5517330ed1e7df544524f3f1118cbd9785391',
	'a30a73a757e80a5d73f787b8e685ecaa7ebdc314',
	'b3d8a63b133009208168351fd795bd34d80a79d6',
	'f36f08a3fa310c9eda3ddac54df61a0290209e90',
	'd17e04667314b759e2fb5b894435ef8a94c67442',
	'e4d5c9daa8cf9b4eb5e14cda869b8cd97bcc767b',
	'fb0dab08a691243c73b368543b0041b2fd5bd15e',
	'440974c7a090abc1a196e006e28e81eb3cd177c2',
	'f8a864a2d58568473e37cfd589999cfb7dee146c',
].map(hash => `https://cdn.akamai.steamstatic.com/steamcommunity/public/images/apps/587620/${hash}.jpg`);
/**
 * Returns a random item from the parameter array
 * @template T The type of the items in the array
 * @param {T[]} arr
 * @param {number} [seed] Optional. A 32 bit integer used as a seed for PRNG
 * which decides which item will be returned. If omitted,
 * `Math.floor(Math.random() * 2**32)` is used.
 * @return {T}
 */
function randomDraw(arr, seed = Math.floor(Math.random() * 2 ** 32)) {
	// Based on https://github.com/cprosche/mulberry32
	let t = seed + 0x6D2B79F5;
	t = Math.imul(t ^ t >>> 15, t | 1);
	t ^= t + Math.imul(t ^ t >>> 7, t | 61);
	const randFloat = ((t ^ t >>> 14) >>> 0) / 4294967296;

	return arr[Math.floor(randFloat * arr.length)];
}

/**
 * Returns an array of Discord Embed objects with information representing what
 * would be posted to the on-this-day announcement channel on the given date,
 * or null if nothing would be posted. An array is returned because of the
 * possibility that length of a single message with all of the event
 * descriptions could exceed the limit of 4096 characters per embed description
 * field. The vast majority of the time, the returned array will contain just
 * one embed.
 * @param {string} guildId The guild for which to look for events
 * @param {Date} dateObj The date object representing a day on which events
 * occurred in previous years, which are described in the returned string
 * @returns {Promise<EmbedBuilder[]|null>} An array of embeds with a title and
 * descriptions related to the events on the given day, or `null` if no events
 * were found
 */
export async function makeOTDAnnouncementEmbeds(guildId, dateObj) {
	const eventObjs = await getOTDEvents(guildId, {
		scope: 'dayAllYears', dateObj,
	});
	if (eventObjs.length === 0) {
		return null;
	}
	const eventUL = eventObjs.map(
		eventObj => `- ${eventObj.date.getFullYear()} — ${eventObj.event}`
	).join('\n');

	const descriptions = splitMessageRegex(eventUL, { maxLength: 4096 });
	const numEmbeds = descriptions.length;

	let borderColor = dateToBorderColor(dateObj);

	// Choose a pseudo-random thumbnail seeded by the parameter date:
	let thumbnail = randomDraw(
		steamAchievementIconURLs,
		( // Seed based on the date:
			dateObj.getFullYear()
			+ dateObj.getMonth() * 1e6
			+ dateObj.getDate() * 1e8
		)
	);

	// On the anniversary of Okami's release, choose a specific color (red from
	// the logo) and image (Top Dog achievement icon):
	if (formatDateNoYear(dateObj) === '20 April') {
		borderColor = [209, 52, 38];
		thumbnail = 'https://cdn.akamai.steamstatic.com/steamcommunity/public/images/apps/587620/1ca064aaa51d907731147c8c19793db6b09f120c.jpg';
	}
	return descriptions.map((desc, i) => (new EmbedBuilder()
		.setColor(borderColor)
		.setTitle(`On this day, ${
			formatDateNoYear(dateObj)
		}${
			(numEmbeds > 1) ? ` (${i + 1} / ${numEmbeds})` : ''
		}...`)
		.setDescription(desc)
		.setThumbnail(thumbnail)
	));
}

/**
 * Based on the "onThisDay" guild config data for each guild, posts a message
 * to the otdChannel, describing events which have occurred on the same day in
 * previous years. If a message has already been sent today according to the
 * config file, no message will be sent and the returned promise will resolve
 * to false.
 * @param {DJSClient} discordClient The Discord client through which to make
 * message send requests
 * @param {string} guildId The id of the Discord guild to post an announcement
 * for.
 * @returns {Promise<boolean>} `true` if a message was sent, `false` otherwise.
 */
export async function postGuildOTDAnnouncement(discordClient, guildId) {
	const guildOTDConfig = await getOTDConfig(guildId);

	// Only post an announcement once per day:
	const today = new Date();
	const todayStr = formatFullDate(today);
	if (guildOTDConfig.lastDayPosted === todayStr) {
		return false;
	}

	const announcementEmbeds = await makeOTDAnnouncementEmbeds(
		guildId, today
	);
	// If there are no embeds for today, don't post anything:
	if (announcementEmbeds === null) {
		return false;
	}

	const otdChannelId = guildOTDConfig.otdChannel;
	const otdChannelAPI = (
		discordClient.channels.resolve(otdChannelId) // If channel is cached
		?? ( // Otherwise, fetch channels from guild API
			await (
				discordClient.guilds.resolve(guildId) // If guild is cached
				?? await discordClient.guilds.fetch(guildId)
			).channels.fetch()
		).get(otdChannelId)
	);

	for (const embed of announcementEmbeds) {
		await otdChannelAPI.send({ embeds: [embed] });
	}
	guildOTDConfig.lastDayPosted = todayStr;
	await setOTDConfig(guildId, guildOTDConfig);
	return true;
}

/**
 * Based on the "onThisDay" guild config data for each guild, posts a message
 * to the otdChannel, describing events which have occurred on the same day in
 * previous years. If a message has already been sent today according to the
 * config file, no message will be sent and the returned promise will resolve
 * to false.
 * @param {DJSClient} discordClient The Discord client through which to make
 * message send requests
 * @param {string[]} guildIds Optional. An array of guild ids to post
 * announcements for. By default, all guild ids listed in the bot's overall
 * config.json file are used.
 * @returns {Promise<void>}
 */
export async function postOTDAnnouncements(
	discordClient,
	guildIds = allGuildIds
) {
	// Wait for all the Discord API calls to complete:
	await Promise.all(
		guildIds.map(id => postGuildOTDAnnouncement(discordClient, id))
	);
}

/**
 * Sets which channel on-this-day event announcements will be made each day.
 * @param {string} guildId The Discord snowflake for the guild
 * @param {string} channelId The snowflake Id of the discord channel in which
 * to post messages about notable events.
 */
export async function setOTDChannel(guildId, channelId) {
	const guildOTDConfig = await getOTDConfig(guildId);
	guildOTDConfig.otdChannel = channelId;
	return await setOTDConfig(guildId, guildOTDConfig);
}
/**
 * Adds an event to the guild's "onThisDay" guild-config file.
 * @param {string} guildId The guild for which this event applies
 * @param {Date} dateObj A JS Date object for the date when an interesting
 * event occurred
 * @param {string} description A single-line string describing the event
 * @returns {Promise<number>} The 0-based index of the new event in the array
 * of all recorded notable events on the exact given date.
 */
export async function addOTDEvent(guildId, dateObj, description) {
	const guildOnThisDay = (
		await getOTDConfig(guildId)
        ?? makeDefault()
	);
	const monthObj = guildOnThisDay.events[dateObj.getMonth()];
	const dayOfMonth = dateObj.getDate();
	const dayObj = monthObj[dayOfMonth];
	const eventYear = dateObj.getFullYear();

	// The index where this new event was added
	let index = 0;
	// If there is no event for this day on this month:
	if (dayObj === undefined) {
		monthObj[dayOfMonth] = { [eventYear]: [description] };
	}
	// If there an event for this day on this month, but not from this year:
	else if (dayObj[eventYear] === undefined) {
		dayObj[eventYear] = [description];
	}
	// If there is an event for this month, day, and year:
	else {
		index = dayObj[eventYear].push(description) - 1;
	}
	await setOTDConfig(guildId, guildOnThisDay);
	return index;
}

export const NOT_PRESENT = Symbol('No event was found at this index on this date.');
export const NO_EVENTS = Symbol('There are no notable events recorded in this guild.');
/**
 * Removes an event to the guild's "onThisDay" guild-config file.
 * @param {string} guildId The guild for which this event applies
 * @param {Date} dateObj A JS Date object for the date when an interesting
 * event occurred
 * @param {number} index The 0-based index into the array of events that
 * occurred on the same date, representing which event to remove. Most dates
 * will only have 1 event, so this value is usually 0.
 * @returns {Promise<string|NOT_PRESENT|NO_EVENTS>} The description of the
 * event which was deleted. If this guild has no events recorded, the NO_EVENTS
 * symbol is returned. If there are events, but none that match the given date
 * and index, the NOT_PRESENT symbol is returned.
 */
export async function removeOTDEvent(guildId, dateObj, index) {
	const guildOnThisDay = await getOTDConfig(guildId);
	if (guildOnThisDay === undefined) {
		return NO_EVENTS;
	}
	const monthObj = guildOnThisDay.events[dateObj.getMonth()];
	const dayOfMonth = dateObj.getDate();
	const dayOfMonthObj = monthObj?.[dayOfMonth];
	const year = dateObj.getFullYear();
	const eventsOnThisDate = dayOfMonthObj?.[year];
	if (eventsOnThisDate === undefined) {
		for (const otherMonthObj of guildOnThisDay.events) {
			// If any non-empty month objects are found (they have a "month"
			// key by default, so length > 1):
			if (Object.keys(otherMonthObj).length > 1) {
				return NOT_PRESENT;
			}
		}
		return NO_EVENTS;
	}
	const deletedEvent = eventsOnThisDate.splice(index, 1);

	// If we removed the last event for this date, remove the year key from
	// the day of month object. This keeps the JSON config file simple.
	if (eventsOnThisDate.length === 0) {
		delete dayOfMonthObj[year];
		// If we removed the last year listed for this month+day, remove the
		// day-of-month key from the month object:
		if (Object.keys(dayOfMonthObj).length === 0) {
			delete monthObj[dayOfMonth];
		}
	}

	await setOTDConfig(guildId, guildOnThisDay);
	return deletedEvent;
}