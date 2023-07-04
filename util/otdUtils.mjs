import { makeDefault } from '../guild-config-schema/onThisDay.mjs';
import * as guildConfig from './guildConfig.mjs';

import { splitSendMessage } from '../util/splitMessageRegex.mjs';

import { pkgRelPath } from './pkgRelPath.mjs';
import { importJSON } from './importJSON.mjs';
const {
	twitch: twitchCredentials,
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
export const formatFullDate = (()=>{
	const formatter = new Intl.DateTimeFormat('en-GB', {
		day: "2-digit", month: "long", year: "numeric"
	});
	return function formatFullDate(dateObj) {
    	return formatter.format(dateObj);
	}
})();
/**
 * Returns a human-readable string date based on the given date parameter,
 * excluding the year
 * @param {Date} dateObj A JS Date object
 * @returns {string} A human-readable text representation of the date
 */
export const formatDateNoYear = (()=>{
	const formatter = new Intl.DateTimeFormat('en-GB', {
		day: "2-digit", month: "long"
	});
	return function formatFullDate(dateObj) {
    	return formatter.format(dateObj);
	}
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
export async function getOTDEvents(guildId, {scope, dateObj}={}) {
    /** @type {OTDConfig} */
	const guildOnThisDay = (
        await guildConfig.get(guildId, 'onThisDay')
        ?? makeDefault()
    );
	if (scope === undefined) {
		if (dateObj !== undefined) {
			throw new Error("dateObj option is specified, but scope is not. Please specify both or neither.")
		}
	}
	if (dateObj === undefined) {
		throw new Error("scope option is specified, but dateObj is not. Please specify both or neither.")
	}
	const eventList = [];
	for (let monthIndex = 0; monthIndex < 12; ++monthIndex) {
		if (
			["day", "month", "dayAllYears"].includes(options.scope)
			&& dateObj.getMonth() !== monthIndex
		) {
			continue;
		}
		const monthObj = guildOnThisDay.events[monthIndex];
		for (const dayOfMonthStr in monthObj) {
			if (
				["day", "dayAllYears"].includes(options.scope)
				&& dateObj.getDate() !== +dayOfMonthStr
			) {
				continue;
			}
			const dayObj = monthObj[dayOfMonthStr];
			for (const yearStr in dayObj) {
				if (
					["day", "month", "year"].includes(options.scope)
					&& dateObj.getFullYear() !== +yearStr
				) {
					continue;
				}
				for (const event of dayObj[yearStr]) {
					const date = new Date(+yearStr, monthIndex, +dayOfMonthStr);
					const eventObj = {date, event}
					eventList.push(eventObj);
				}
			}
		}
	}
    return eventList;
}

/**
 * Returns a string representing what would be posted to the on-this-day
 * announcement channel on the given date.
 * @param {string} guildId The guild for which this event applies
 * @param {Date} dateObj The date object representing a day on which events
 * occurred in previous years, which are described in the returned string.
 * @returns {Promise<string>}
 */
export async function makeOTDAnnouncementString(guildId, dateObj) {
	const eventUL = (await getOTDEvents(
		guildId,
		{ scope: 'dayAllYears',	dateObj	}
	)).map(
		eventObj => `\n- ${eventObj.date.getFullYear()} — ${eventObj.event}`
	).join("");
	return `On this day, ${formatDateNoYear(dateObj)}...${eventUL}`
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
	const todayStr = formatFullDate(today)
	if (guildOTDConfig.lastDayPosted === todayStr) {
		return false;
	}

	const otdChannelAPI = (
		discordClient.channels.resolve(channel) // If channel is cached
		?? ( // Otherwise, fetch channels from guild API
			await (
				discordClient.guilds.resolve(guildId) // If guild is cached
				?? await discordClient.guilds.fetch(guildId)
			).channels.fetch()
		).get(channel)
	);
	await splitSendMessage(
		otdChannelAPI,
		makeOTDAnnouncementString(guildId, today),
		undefined,
		{ suppressEmbeds: true } 
	);
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
    return await setOTDConfig(guildId, guildOTDConfig)
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
        await guildConfig.get(guildId, 'onThisDay')
        ?? makeDefault()
    );
    const monthObj = guildOnThisDay[dateObj.getMonth()];
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
	await guildConfig.set(guildId, 'onThisDay', guildOnThisDay);
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
	const guildOnThisDay = await guildConfig.get(guildId, 'onThisDay');
	if (guildOnThisDay === undefined) {
		return NO_EVENTS;
	}
	const eventsOnThisDate = (guildOnThisDay
		[dateObj.getMonth()]
		?.[dateObj.getDate()]
		?.[dateObj.getFullYear()]
	);
	if (eventsOnThisDate === undefined) {
		return NOT_PRESENT;
	}
	const deletedEvent = eventsOnThisDate.splice(index, 1);
	await guildConfig.set(guildId, 'onThisDay', guildOnThisDay);
	return deletedEvent;
}