import { setTimeout as wait } from 'node:timers/promises';

import { MessageEmbed, Util } from 'discord.js';

import { ClientCredentialsAuthProvider } from '@twurple/auth';
import { ApiClient } from '@twurple/api';

import * as guildConfig from './guildConfig.mjs';

import { makeDefault } from '../guild-config-schema/twitch.mjs';

import { AsyncCache } from './AsyncCache.mjs';

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
 * @typedef { import('../guild-config-schema/twitch.mjs').TwitchConfig } TwitchConfig
 * @typedef { import("discord.js").Client } DJSClient
 * @typedef { import("discord.js").Guild } Guild
 * @typedef { import("discord.js").BaseGuildTextChannel } BaseGuildTextChannel
 * @typedef { import("discord.js").Message } Message
 * @typedef { import("@twurple/api").HelixStream } HelixStream
 * @typedef { import("@twurple/api").HelixUser } HelixUser
 * @typedef { import("@twurple/api").HelixGame } HelixGame
 * @typedef { import("@twurple/api").HelixVideo } HelixVideo
 */


/**
 * @param {string} guildId
 * @returns {Promise<TwitchConfig>} The Twitch Config object for the given
 * guild, or an empty data structure which matches the Twitch config schema
 */
async function getTwitchConfig(guildId) {
	const guildTwitchConfig = await guildConfig.get(guildId, 'twitch');
	if (guildTwitchConfig === undefined) {
		return makeDefault();
	}
	return guildTwitchConfig;
}

const twitchClient = new ApiClient({
	authProvider: new ClientCredentialsAuthProvider(
		twitchCredentials.clientId,
		twitchCredentials.clientSecret
	),
});

/** @type {AsyncCache<string, HelixUser>} */
const twitchUserCache = new AsyncCache((userId) => {
	return twitchClient.users.getUserById(userId);
});
/** @type {AsyncCache<string, HelixGame>} */
const twitchGameCache = new AsyncCache((userId) => {
	return twitchClient.games.getGameById(userId);
});

/**
 * Creates a Discord.js embed based on the given Twitch stream
 * @param {HelixStream} stream
 * @returns {Promise<MessageEmbed>} An embed with fields based on the stream
 */
export async function makeStreamEmbed(stream) {
	const {
		userDisplayName,
		userName,
		gameName,
		title,
		startDate,
		thumbnailUrl,
	} = stream;
	const streamLink = new URL('https://www.twitch.tv');
	streamLink.pathname = encodeURIComponent(userName);
	const urlStr = streamLink.toString();

	const [streamer, game] = await Promise.all([
		twitchUserCache.fetch(stream.userId),
		twitchGameCache.fetch(stream.gameId),
	]);
	return (new MessageEmbed()
		.setColor(0x9146ff) // Twitch Color
		.setAuthor({
			name: `${userDisplayName} is playing ${gameName}! `,
			url: urlStr,
			iconURL: streamer.profilePictureUrl,
		})
		.setTitle(urlStr)
		.setURL(urlStr)
		.setDescription(Util.escapeMarkdown(title).replaceAll('`', '\\`'))
		.setThumbnail(game.boxArtUrl.replace('{width}x{height}', '240x320'))
		.setImage(thumbnailUrl.replace('-{width}x{height}', ''))
		.setTimestamp(startDate)
	);
}
/**
 * Gets the HelixStream object for a given username
 * @param {string} username The Twitch username or display name to check
 * @returns {Promise<HelixStream|null>} The stream object, or `null` if the user
 * is not live.
 */
export async function getUserStream(username) {
	return await twitchClient.streams.getStreamByUserName(username);
}

/**
 * Gets the Twitch API game data for a given game name
 * @param {string} gameName A game name as listed on Twitch. Note that some
 * games may have multiple valid names based on the "Alternative Names" listed
 * on https://www.igdb.com/, and some seemingly valid names may give unexpected
 * results.
 * @return {Promise<HelixGame|null>} The corresponding HelixGame object from the
 * Twitch API, or `null` if there is no game with a matching name.
 */
export async function getGameByName(gameName) {
	return await twitchClient.games.getGameByName(gameName);
}

/**
 * Gets the Twitch API user data for a given user name (not case-sensitive)
 * @param {string} userName A user name as listed on Twitch.
 * @return {Promise<HelixUser|null>} The corresponding HelixUser object from the
 * Twitch API, or `null` if there is no user with a matching name.
 */
export async function getUserByName(userName) {
	return await twitchClient.users.getUserByName(userName);
}


/**
 * Gets video data from the Twitch video API for a single video id
 * https://dev.twitch.tv/docs/api/reference#get-videos
 * @param {string} videoId
 * @returns {Promise<HelixVideo>}
 */
export async function getVideo(videoId) {
	return await twitchClient.videos.getVideoById(videoId);
}

/**
 * @param {string} guildId The snowflake of the Discord guild to set the streams
 * channel of
 * @param {string} channelId The id of the channel to set as the streams channel
 * @returns {Promise<void>}
 */
export async function setStreamsChannel(guildId, channelId) {
	const guildTwitchConfig = await getTwitchConfig(guildId);
	guildTwitchConfig.streamsChannel = channelId;
	await guildConfig.set(guildId, 'twitch', guildTwitchConfig);
}

/**
 * Resets the twitch config fields which store data related to currently live
 * streams. This means that the bot will forget about messages it has already
 * posted and post them again the next time the monitorTwitchStreams routine
 * runs. This can be useful if those messages were deleted and you want them to
 * be posted again sooner.
 * @param {string} guildId The snowflake of the Discord guild to clear
 * @returns {Promise<void>}
 */
export async function clearStreamData(guildId) {
	const guildTwitchConfig = await getTwitchConfig(guildId);
	guildTwitchConfig.streamsChannelMessages = {};
	guildTwitchConfig.singleStreamMessages = {};
	guildTwitchConfig.singleStreamBlockedUsers = {};
	await guildConfig.set(guildId, 'twitch', guildTwitchConfig);
}

/**
 * @param {string} guildId The snowflake of the Discord guild to set the streams
 * channel of
 * @returns {Promise<string>} The snowflake of the discord channel which is set
 * as the streams channel for this guild
 */
export async function getStreamsChannel(guildId) {
	const guildTwitchConfig = await getTwitchConfig(guildId);
	return guildTwitchConfig.streamsChannel;
}

export const GAME_NOT_FOUND = Symbol('No such game was found.');
export const GAME_ALREADY_FOLLOWED = Symbol('This game was already being followed in this guild.');
/**
 * Sets a game to be followed in a given guild
 * @param {string} guildId The snowflake of the Discord guild to follow this
 * game in.
 * @param {string} gameName A game name as listed on Twitch to follow.
 * @returns {Promise<HelixGame|GAME_NOT_FOUND|GAME_ALREADY_FOLLOWED>} The Twitch
 * API response for the followed game, or a Symbol describing the failure mode
 */
export async function followGame(guildId, gameName) {
	const game = await getGameByName(gameName);
	if (game === null) {
		return GAME_NOT_FOUND;
	}
	// Use the name given by the API, because sometimes the alternative names
	// listed on igdb.com will still return the correct Twitch API entry. e.g.
	// getGameByName('okami') will return the entry for 'Ōkami'.
	const apiGameName = game.name;
	const guildTwitchConfig = await getTwitchConfig(guildId);
	const guildFollowedGames = guildTwitchConfig.followedGames;
	if (apiGameName in guildFollowedGames) {
		return GAME_ALREADY_FOLLOWED;
	}
	guildFollowedGames[apiGameName] = game.id;
	await guildConfig.set(guildId, 'twitch', guildTwitchConfig);
	return game;
}

export const USER_NOT_FOUND = Symbol('No such user was found.');
export const USER_ALREADY_FOLLOWED = Symbol('This user was already being followed in this guild.');
/**
 * Sets a user to be followed in a given guild
 * @param {string} guildId The snowflake of the Discord guild to follow this
 * user in.
 * @param {string} userName A user name as listed on Twitch to follow.
 * @returns {Promise<HelixUser|USER_NOT_FOUND|USER_ALREADY_FOLLOWED>} The Twitch
 * API response for the followed user, or a Symbol describing the failure mode
 */
export async function followUser(guildId, userName) {
	const user = await getUserByName(userName);
	if (user === null) {
		return USER_NOT_FOUND;
	}
	const apiUserName = user.name;
	const guildTwitchConfig = await getTwitchConfig(guildId);
	const guildFollowedUsers = guildTwitchConfig.followedUsers;
	if (apiUserName in guildFollowedUsers) {
		return USER_ALREADY_FOLLOWED;
	}
	guildFollowedUsers[apiUserName] = user.id;
	await guildConfig.set(guildId, 'twitch', guildTwitchConfig);
	return user;
}

export const USER_ALREADY_BLOCKED = Symbol('This user was already being blocked in this guild.');
/**
 * Sets a user to be blocked in a given guild, such that their streams won't be
 * automatically posted in the streamsChannel, even if they stream a followed
 * game with a keyword in the title
 * @param {string} guildId The snowflake of the Discord guild to block this
 * user in.
 * @param {string} userName A user name as listed on Twitch to block.
 * @returns {Promise<HelixUser|USER_NOT_FOUND|USER_ALREADY_BLOCKED>} The Twitch
 * API response for the blocked user, or a Symbol describing the failure mode
 */
export async function blockUser(guildId, userName) {
	const user = await getUserByName(userName);
	if (user === null) {
		return USER_NOT_FOUND;
	}
	const apiUserName = user.name;
	const guildTwitchConfig = await getTwitchConfig(guildId);
	const guildBlockedUsers = guildTwitchConfig.blockedUsers;
	if (apiUserName in guildBlockedUsers) {
		return USER_ALREADY_BLOCKED;
	}
	guildBlockedUsers[apiUserName] = user.id;
	await guildConfig.set(guildId, 'twitch', guildTwitchConfig);
	return user;
}

export const GAME_UNFOLLOWED = Symbol('Game was successfully unfollowed.');
export const GAME_NOT_FOLLOWED = Symbol('Game was already not being followed.');
/**
 * Removes a game from the list of followed games in the given guild
 * @param {string} guildId The snowflake of the Discord guild to unfollow this
 * game in.
 * @param {string} gameName The name of the game to be unfollowed, exactly as
 * listed on Twitch.
 * @returns {Promise<GAME_UNFOLLOWED|GAME_NOT_FOLLOWED>} A descriptive symbol
 * corresponding to the result of attempting to unfollow the game.
 */
export async function unfollowGame(guildId, gameName) {
	const guildTwitchConfig = await getTwitchConfig(guildId);
	const guildFollowedGames = guildTwitchConfig.followedGames;
	if (gameName in guildFollowedGames) {
		delete guildFollowedGames[gameName];
		return GAME_UNFOLLOWED;
	}
	return GAME_NOT_FOLLOWED;
}


export const USER_UNFOLLOWED = Symbol('User was successfully unfollowed.');
export const USER_NOT_FOLLOWED = Symbol('User was already not being followed.');
/**
 * Removes a user from the list of followed users in the given guild
 * @param {string} guildId The snowflake of the Discord guild to unfollow this
 * user in.
 * @param {string} userName The name of the user to be unfollowed, exactly as
 * listed on Twitch.
 * @returns {Promise<USER_UNFOLLOWED|USER_NOT_FOLLOWED>} A descriptive symbol
 * corresponding to the result of attempting to unfollow the user.
 */
export async function unfollowUser(guildId, userName) {
	// Usernames should always be lowercase, whereas displayNames contain the
	// capitalization:
	userName = userName.toLocaleLowerCase();
	const guildTwitchConfig = await getTwitchConfig(guildId);
	const guildFollowedUsers = guildTwitchConfig.followedUsers;
	if (userName in guildFollowedUsers) {
		delete guildFollowedUsers[userName];
		return USER_UNFOLLOWED;
	}
	return USER_NOT_FOLLOWED;
}

export const USER_UNBLOCKED = Symbol('User was successfully unblocked.');
export const USER_NOT_BLOCKED = Symbol('User was already not being blocked.');
/**
 * Removes a user from the list of blocked users in the given guild, as well
 * as the singleStreamBlockedUsers list, which users are added to when their
 * stream messages are deleted before the stream ends.
 * @param {string} guildId The snowflake of the Discord guild to unblock this
 * user in.
 * @param {string} userName The name of the user to be unblocked, exactly as
 * listed on Twitch.
 * @returns {Promise<USER_UNBLOCKED|USER_NOT_BLOCKED>} A descriptive symbol
 * corresponding to the result of attempting to unblock the user.
 */
export async function unblockUser(guildId, userName) {
	userName = userName.toLowerCase(); // Usernames are always lowercase
	const guildTwitchConfig = await getTwitchConfig(guildId);
	const guildBlockedUsers = guildTwitchConfig.blockedUsers;
	const guildSingleStreamBlocked = guildTwitchConfig.singleStreamBlockedUsers;
	let unblocked = false;
	if (userName in guildBlockedUsers) {
		delete guildBlockedUsers[userName];
		unblocked = true;
	}
	if (userName in guildSingleStreamBlocked) {
		delete guildSingleStreamBlocked[userName];
		unblocked = true;
	}
	return (unblocked) ? USER_UNBLOCKED : USER_NOT_BLOCKED;
}

/**
 * @param {string} guildId The snowflake of the Discord guild to check the
 * followed games of
 * @returns {Promise<string[]>} An array of Twitch game names for guild's
 * followed games
 */
export async function getFollowedGameNames(guildId) {
	const guildTwitchConfig = await getTwitchConfig(guildId);
	return Object.keys(guildTwitchConfig.followedGames);
}

/**
 * @param {string} guildId The snowflake of the Discord guild to check the
 * followed users of
 * @returns {Promise<string[]>} An array of Twitch user names for guild's
 * followed users
 */
export async function getFollowedUserNames(guildId) {
	const guildTwitchConfig = await getTwitchConfig(guildId);
	return Object.keys(guildTwitchConfig.followedUsers);
}

/**
 * @param {string} guildId The snowflake of the Discord guild to check the
 * blocked users of
 * @returns {Promise<string[]>} An array of Twitch user names for guild's
 * blocked users, both those that are generally blocked and those that are
 * only blocked until they stop their current stream.
 */
export async function getBlockedUserNames(guildId) {
	const guildTwitchConfig = await getTwitchConfig(guildId);
	const blocked = Object.keys(guildTwitchConfig.blockedUsers);
	blocked.push(...Object.keys(guildTwitchConfig.singleStreamBlockedUsers));
	return blocked;
}

/**
 * Sets an array of keywords as required, such that only streams of followed
 * games with one or more of them in the title are reported by
 * `monitorTwitchStreams.mjs`. These are not case sensitive but must be present
 * as whole-words (delimited by word boundaries \b)
 * @param {string} guildId The snowflake of the Discord guild to mark these
 * keywords as required in
 * @param {string[]} keywords An array of strings which must be present in the
 * title of a Twitch stream for it to be reported.
 * @return {Promise<void>}
 */
export async function setKeywords(guildId, keywords) {
	const guildTwitchConfig = await getTwitchConfig(guildId);
	guildTwitchConfig.keywords = keywords;
	await guildConfig.set(guildId, 'twitch', guildTwitchConfig);
}


/**
 * Gets an array of keywords, at least one of which must be in the title of a
 * stream of a followed game in the given guild for that stream to be reported
 * @param {string} guildId The snowflake of the Discord guild to get the
 * keywords for
 * @returns {Promise<string[]>} An array of keywords required in the guild
 */
export async function getKeywords(guildId) {
	const guildTwitchConfig = await getTwitchConfig(guildId);
	return guildTwitchConfig.keywords;
}

/**
 * Adds the given stream to the list of temporarily-monitored streams, such that
 * when it is next found offline (by the `monitorTwitchStreams` routine) the
 * given message will be deleted.
 * @param {HelixStream} stream The currently live stream to monitor.
 * @param {Message} message The message to delete when the stream is offline.
 * @param {object} [guildTwitchConfig] Optional. The Twitch config object for
 * the guild that the message was sent to. If omitted, the twitch config for the
 * guild the message is in will be retrieved and used.
 * @return {Promise<void>}
 */
export async function monitorStreamMessage(stream, message, guildTwitchConfig) {
	const { guildId } = message;
	guildTwitchConfig ??= await getTwitchConfig(guildId);
	const tempUsers = guildTwitchConfig.singleStreamMessages;
	const { userId, title, gameId } = stream;
	const messageData = {
		channel: message.channelId,
		message: message.id,
		title,
		gameId,
	};
	if (userId in tempUsers) {
		tempUsers[userId].push(messageData);
	}
	tempUsers[userId] = [messageData];
	await guildConfig.set(guildId, 'twitch', guildTwitchConfig);
}

/**
 * A wrapper around twurple streams.getStreamsPaginated which allows for
 * specifying more than 100 user/game ids at a time, by just splitting the ids
 * across multiple requests. Be aware that a limit MAX_NUM_IDS is given to avoid
 * potential rate limit issues.
 * @param {string[]} idArr The array of ids which should be requested
 * @param {'game'|'userId'} idType Whether the ids correspond to Twitch game ids
 * or user ids
 */
async function* getStreamsManyIds(idArr, idType) {
	// How many ids can be specified per request:
	const MAX_GROUP_SIZE = 100;

	const numIds = idArr.length;
	const MAX_NUM_IDS = 2000;
	if (numIds > MAX_NUM_IDS) {
		throw new RangeError(`The number of ids specified ${numIds} exceeds the safety limit ${MAX_NUM_IDS}.`);
	}
	const numGroups = Math.ceil(numIds / MAX_GROUP_SIZE);
	GroupLoop: for (let i = 0; i < numGroups; ++i) {
		const groupStart = i * MAX_GROUP_SIZE;
		const groupEnd = Math.min(groupStart + MAX_GROUP_SIZE, numIds);
		const groupIds = idArr.slice(groupStart, groupEnd);
		const streamFilter = { [idType]: groupIds, type: 'live' };

		// Try to catch twitch API fetchErrors and retry the request a few times if
		// they fail:
		const MAX_ATTEMPTS = 5;
		const RETRY_DELAY_MS = 500;
		let errCause;
		for (let attempts = 0; attempts < MAX_ATTEMPTS; ++attempts) {
			try {
				const request = twitchClient.streams.getStreamsPaginated(streamFilter);
				for await (const stream of request) {
					yield stream;
				}
				continue GroupLoop;
			}
			catch (fetchError) {
				console.error(`Request for streams by ${idType} failed attempt ${attempts + 1}.${(attempts < MAX_ATTEMPTS) ? ' Retrying...' : ''}`);
				errCause = fetchError;
				await wait(RETRY_DELAY_MS);
			}
		}
		throw new Error(
			`Request for streams by ${idType} failed after ${MAX_ATTEMPTS} retries:`,
			{ cause: errCause }
		);
	}
}

/**
 * Edits the given stream message to be updated based on the given HelixStream,
 * and updates the twitch guild-config data to reflect the update
 * @param {BaseGuildTextChannel} channel The discord.js channel object
 * containing the message
 * @param {string} messageId The snowflake of the message to edit
 * @param {HelixStream} stream The HelixStream to based the updated message on
 * @param {TwitchConfig} guildTwitchConfig The Twitch config object for the
 * guild that the message is in.
 * @returns {Promise<boolean>} Returns true if the message was successfully
 * edited, false if the edit failed (e.g. if the message was already deleted)
 */
async function updateStreamMessage(
	channel,
	messageId,
	stream,
	guildTwitchConfig,
) {
	const embed = await makeStreamEmbed(stream);
	const channelId = channel.id;
	const { userId, title, gameId } = stream;
	try {
		await channel.messages.edit(messageId, { embeds: [embed] });
	}
	catch (messageEditError) {
		if (channelId === guildTwitchConfig.streamsChannel) {
			delete guildTwitchConfig.streamsChannelMessages[userId];

			// If a message in the streams channel was deleted by a mod before it
			// could be edited, add it to the single-stream blocklist so it doesn't
			// get reposted the next time the monitorTwitchStreams routine runs:
			guildTwitchConfig.singleStreamBlockedUsers[stream.userName] = userId;
			return false;
		}
		// If the message is in some other channel, it must have been a single-
		// stream message, in which case we should search for the config entry
		// for it and delete it.
		const messagesForUser = guildTwitchConfig.singleStreamMessages[userId];
		for (let i = 0, len = messagesForUser.length; i < len; ++i) {
			const messageObj = messagesForUser[i];
			if (messageObj.message !== messageId) {
				continue;
			}
			messagesForUser.splice(i, 1);
			return false;
		}
	}
	// If the message was successfully edited, update its values in the config:
	const messageData = (
		guildTwitchConfig.streamsChannelMessages[userId]
		?? guildTwitchConfig.singleStreamMessages[userId].find(
			singleStreamMessage => singleStreamMessage.message === messageId
		)
	);
	messageData.title = title;
	messageData.gameId = gameId;
	return true;
}

/**
 * Sends a stream message for the given stream to the guild's streamsChannel
 * @param {BaseGuildTextChannel} streamsChannelAPI The discord.js channel object
 * for the streamsChannel, to which to send the message
 * @param {HelixStream} stream The HelixStream to based the stream message on
 * @param {TwitchConfig} guildTwitchConfig The Twitch config object for the
 * guild that the message will be sent in. THIS FUNCTION DOESN'T COMMIT THE
 * CONFIG. YOU MUST USE `guildConfig.set()` SEPARATELY!!
 * @returns {Promise<void>}
 */
async function sendStreamMessage(
	streamsChannelAPI,
	stream,
	guildTwitchConfig,
) {
	const { streamsChannel, streamsChannelMessages } = guildTwitchConfig;
	if (streamsChannelAPI.id !== streamsChannel) {
		throw new Error('The sendStreamMessage function should only be used to send messages to the streamsChannel');
	}
	const embed = await makeStreamEmbed(stream);

	const botMsg = await streamsChannelAPI.send({
		embeds: [embed],
		allowedMentions: { parse: [] }, // Prevent injection of @mentions
	});
	streamsChannelMessages[stream.userId] = {
		message: botMsg.id,
		title: stream.title,
		gameId: stream.gameId,
	};
}

/**
 * A function for adding values to a map which maps from keys to arrays of
 * values. If the key is not yet defined, a new array is automatically created
 * to wrap the value.
 * @template K,V
 * @param {Map<K,V[]>} map
 * @param {K} key
 * @param {V} value
 * @returns {void}
 */
function mapOfArraysPush(map, key, value) {
	const arr = map.get(key);
	if (arr === undefined) {
		map.set(key, [value]);
		return;
	}
	arr.push(value);
}

/**
 * Bulk deletes messages, but catches and ignores the error which gets thrown if
 * only a single message is given and it does not exist (e.g. it was already
 * deleted).
 * @param {BaseGuildTextChannel} channelAPI The d.js channel object containing
 * the messages to delete
 * @param {string[]} messages An array of message snowflakes to delete
 * @returns {Promise<Collection <Snowflake, Message>|void>} Returns the same as
 * bulkDelete, or `undefined` if the message to be deleted was already deleted.
 */
async function safeBulkDelete(channelAPI, messages) {
	if (messages.length === 1) {
		try {
			return await channelAPI.bulkDelete(messages);
		}
		catch (messageAlreadyDeletedError) {
			// bulkDelete uses the normal message-delete endpoint if there is only one
			// message. Unlike the normal bulkDelete endpoint, this endpoint can throw
			// an error if the message doesn't exist (e.g. if it was already deleted),
			// so we catch that specific case and then do nothing.
			return;
		}
	}
	return await channelAPI.bulkDelete(messages);
}

/**
 * Retrieves all monitored streams across an array of guilds by making the
 * minimum number of requests to the Twitch Helix API
 * @param {string[]} [guildIds] Optional. An array of Discord snowflakes for
 * guild ids, representing the guilds to check the monitored streams of. By
 * default, this is all guilds listed in the general config.json
 * @returns {Promise<{
 * 	guildTwitchConfigs: Map<string, TwitchConfig>,
 * 	userIdToStreamMap: Map<string, HelixStream>,
 * 	gameIdToStreamsMap: Map<string, HelixStream[]>,
 * }>}
 */
async function getMonitoredStreams(guildIds = allGuildIds) {
	/** @type {Map<string, HelixStream>} */
	const userIdToStreamMap = new Map();
	/** @type {Map<string, HelixStream[]>} */
	const gameIdToStreamsMap = new Map();

	const gameIdsToRequest = new Set();
	const userIdsToRequest = new Set();

	/** @type {Map<string, TwitchConfig>} */
	const guildTwitchConfigs = new Map();

	// For each guild, get the list of game/user ids to request, so that we can
	// do two big requests for all the guilds at once.
	for (const guildId of guildIds) {
		const guildTwitchConfig = await getTwitchConfig(guildId);
		if (guildTwitchConfig === undefined) {
			continue;
		}
		guildTwitchConfigs.set(guildId, guildTwitchConfig);
		const {
			followedGames,
			followedUsers,
			singleStreamMessages,
		} = guildTwitchConfig;

		for (const gameId of Object.values(followedGames)) {
			gameIdsToRequest.add(gameId);
		}
		for (const userId of Object.values(followedUsers)) {
			userIdsToRequest.add(userId);
		}
		for (const userId of Object.keys(singleStreamMessages)) {
			userIdsToRequest.add(userId);
		}
	}

	const gameIdsArr = Array.from(gameIdsToRequest);
	// In case there are more than 100 unique game ids or user ids in total, use
	// this custom async generator to split it across multiple requests
	// automatically:
	for await (const gameStream of getStreamsManyIds(gameIdsArr, 'game')) {
		const { userId, gameId } = gameStream;
		userIdToStreamMap.set(userId, gameStream);
		mapOfArraysPush(gameIdToStreamsMap, gameId, gameStream);

		// If a followed game already contains a stream from a followed user, there's
		// no need to request the stream for that user:
		userIdsToRequest.delete(userId);
	}

	const userIdsArr = Array.from(userIdsToRequest);
	for await (const userStream of getStreamsManyIds(userIdsArr, 'userId')) {
		userIdToStreamMap.set(userStream.userId, userStream);
		mapOfArraysPush(gameIdToStreamsMap, userStream.gameId, userStream);
	}

	return {
		guildTwitchConfigs,
		userIdToStreamMap,
		gameIdToStreamsMap,
	};
}

/**
 * Escapes generic strings to be used in regular expressions constructed with
 * `new RegExp()`. Copied from
 * https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_Expressions#escaping
 * @param {string} string Any string
 * @returns {string} A string escaped so that it will be matched literally if
 * used as part of the input to `new RegExp()`
 */
function escapeRegExp(string) {
	// $& means the whole matched string
	return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Send, edit, and delete stream messages for the given guild, based on the data
 * in the given twitch guildConfig object:
 * @param {object} o
 * @param {DJSClient} o.discordClient The Discord client through which to make
 * message send/edit/delete requests
 * @param {string} o.guildId The snowflake id for the Discord guild to update
 * the stream messages of
 * @param {TwitchConfig} o.guildTwitchConfig The twitch guildConfig object for
 * this guild, used to identify which messages to edit/delete and which streams
 * to send messages for. Get this from `guildConfig.get`.
 * @param {Map<string, HelixStream>} o.userIdToStreamMap A map from Twitch API
 * user ids to HelixStream objects. Get this from `getMonitoredStreams`.
 * @param {Map<string, HelixStream[]>} o.gameIdToStreamsMap A map from Twitch
 * API game ids to HelixStream objects. Get this from `getMonitoredStreams`.
 * @returns {Promise<void>}
 */
async function updateGuildStreamMessages({
	discordClient,
	guildId,
	guildTwitchConfig,
	userIdToStreamMap,
	gameIdToStreamsMap,
} = {}) {
	const guild = (
		discordClient.guilds.resolve(guildId)
		?? await discordClient.guilds.fetch(guildId)
	);
	// Rather than awaiting each discord API call (send, edit, and delete
	// messages) as they're made, store the promises so we can use
	// `await Promise.all()` at the end:
	const discordAPIPromises = [];

	// This function is called when returning from the outer function, in order to
	// ensure API calls are completed and changes made to the guild twitch config
	// are saved/committed:
	const finishUpdating = async () => {
		await Promise.all(discordAPIPromises);
		await guildConfig.set(guildId, 'twitch', guildTwitchConfig);
		return;
	};

	const {
		streamsChannel,
		streamsChannelMessages,
		followedGames,
		keywords,
		followedUsers,
		blockedUsers,
		singleStreamBlockedUsers,
		singleStreamMessages,
	} = guildTwitchConfig;
	const blockedUsersIdSet = new Set(Object.values(blockedUsers));

	// Store all messages to be deleted so they can be bulkDeleted per channel:
	/** @type {Map<string, string[]>} */
	const channelIdToMessagesToDeleteMap = new Map();
	const channels = discordClient.channels;

	// First, we loop over all single-stream messages and see if any of those need
	// to be deleted or edited:
	const streamsChannelMessagesToDelete = [];
	for (const twitchUserId in singleStreamMessages) {
		const messagesForUser = singleStreamMessages[twitchUserId];
		const stream = userIdToStreamMap.get(twitchUserId);

		// If the user associated with the message is no longer streaming, or if a
		// user has been blocked since a stream message was posted, remove it from
		// the list of messages followed for a single stream and mark the  message
		// for deletion:
		if (stream === undefined || blockedUsersIdSet.has(twitchUserId)) {
			delete singleStreamMessages[twitchUserId];

			// It's possible that some single-stream messages could be posted in the
			// streams channel (if one is set for this guild). In this case, we want
			// to bulk delete them along with the messages for followed games/users,
			// so save them to a separate list:
			for (const messageData of messagesForUser) {
				const { channel, message } = messageData;
				if (channel === streamsChannel) {
					streamsChannelMessagesToDelete.push(message);
					continue;
				}
				mapOfArraysPush(channelIdToMessagesToDeleteMap, channel, message);
			}
			continue;
		}

		// If the stream isn't over, check if the messages need to be updated:
		// for (const messageData of messagesForUser) {
		for (let i = 0, len = messagesForUser.length; i < len; ++i) {
			const messageData = messagesForUser[i];
			const { title, gameId, channel, message } = messageData;

			// If the info relevant to the stream message embed hasn't changed don't
			// bother updating the message.
			//
			// NOTE: In theory, all the single-stream messages for any given user's
			// stream should be kept up-to-date and so should have the same title and
			// gameId properties, so really this shouldn't be on every message object
			// in the array. However, this would be an annoying change to implement
			// for almost no benefit.
			if (title === stream.title && gameId === stream.gameId) {
				continue;
			}
			// If the stream message needs updating, retrieve the channel from the
			// cache or fetch it if needed (while adding the other channels for the
			// guild to the cache), then update the message:
			const channelAPI = (
				channels.resolve(channel)
				?? (await guild.channels.fetch()).get(channel)
			);
			// If the channel in which the message was posted has since been deleted,
			// remove the config record of the message and don't try to update it:
			if (channelAPI === undefined) {
				messagesForUser.splice(i, 1);
				continue;
			}

			discordAPIPromises.push(updateStreamMessage(
				channelAPI,
				message,
				userIdToStreamMap.get(twitchUserId),
				guildTwitchConfig,
			));
		}
	}

	// Loop over the singleStreamMessages which need to be deleted and make the
	// appropriate API calls
	for (const channelId of channelIdToMessagesToDeleteMap.keys()) {
		const channelAPI = (
			channels.resolve(channelId)
			?? (await guild.channels.fetch()).get(channelId)
		);
		discordAPIPromises.push(
			safeBulkDelete(channelAPI, channelIdToMessagesToDeleteMap.get(channelId))
		);
	}

	// Second, we loop over the users who are blocked from having their stream
	// posted in the streams channel until they stop streaming (because their
	// stream message has been deleted earlier), and remove anyone from the
	// blocklist who is no longer streaming:
	const singleStreamBlockedUsersIdSet = new Set();
	for (const [userName, userId] of Object.entries(singleStreamBlockedUsers)) {
		if (userIdToStreamMap.has(userId)) {
			singleStreamBlockedUsersIdSet.add(userId);
			continue;
		}
		delete singleStreamBlockedUsers[userName];
	}

	// If there is no streams channel set in this guild's twitch config, we can
	// simply return after editing/deleting the single-stream messages and
	// unblocking the single-stream blocked users who stopped streaming:
	if (streamsChannel === undefined) {
		return await finishUpdating();
	}

	// Retrieve the Discord.js channel object for the streams channel. By default,
	// get it synchronously from the cache, or if it's not cahced, fetch it from
	// the API:
	let streamsChannelAPI;
	try {
		streamsChannelAPI = (
			channels.resolve(streamsChannel)
			?? await channels.fetch(streamsChannel)
		);
	}
	catch (channelDeletedError) {
		// If the actual streamsChannel was deleted, it will be absent from the
		// cache and fetch will throw an error. In that case, just delete it from
		// the config and exit the function. The user will have to set another
		// streamsChannel using the /manage-twitch command to re-enable monitoring
		// for the guild.
		delete guildTwitchConfig.streamsChannel;
		return await finishUpdating();
	}

	// If there *is* a streams channel, handle the messages already posted there,
	// as well as any followed users/games:
	const followedGameIdSet = new Set(Object.values(followedGames));
	const anyKeywords = (keywords.length > 0);

	// Pre-compile a regular expression used to check if a title contains at least
	// one keyword
	const keywordRegex = (anyKeywords
		? new RegExp(
			`(?<=\\W|^)(${keywords.map(escapeRegExp).join('|')})(?=\\W|$)`,
			'i'
		)
		: undefined
	);
	/**
	 * Returns true if there are no required keywords for this guild, or if the
	 * given stream has at least one of the keywords in the title. Used to
	 * determine whether a game stream should be reported/have its message
	 * updated:
	 * @param {HelixStream} stream
	 * @returns {boolean}
	 */
	const hasKeyword = (stream) => (
		!anyKeywords
		|| keywordRegex.test(stream.title)
	);

	const followedUserIdSet = new Set(Object.values(followedUsers));

	// Third, for each message that has already been posted in the streams
	// channel, check if any should be edited or deleted:
	for (const twitchUserId in streamsChannelMessages) {
		const { message, title, gameId } = streamsChannelMessages[twitchUserId];
		const stream = userIdToStreamMap.get(twitchUserId);

		// If the user associated with the message is no longer streaming, or if a
		// user has been blocked since a stream message was posted, delete the
		// message:
		if (stream === undefined || blockedUsersIdSet.has(twitchUserId)) {
			delete streamsChannelMessages[twitchUserId];
			streamsChannelMessagesToDelete.push(message);
			continue;
		}

		const embedInfoChanged = (
			title !== stream.title || gameId !== stream.gameId
		);
		const updateMessageIfNeeded = () => {
			if (!embedInfoChanged) return;
			discordAPIPromises.push(updateStreamMessage(
				streamsChannelAPI,
				message,
				stream,
				guildTwitchConfig,
			));
		};

		// If the user associated with the message is still streaming and is a
		// followed user, check if the message needs to be edited due to a change
		// in stream info
		if (followedUserIdSet.has(twitchUserId)) {
			updateMessageIfNeeded();
			continue;
		}
		// If the user is streaming and isn't a followed user, check if they're
		// still streaming a required game with at least 1 keyword (if any) in the
		// title. If so, check if the message needs to be edited. If not, add the
		// mesage to the list of messages to be deleted.
		if (followedGameIdSet.has(stream.gameId) && hasKeyword(stream)) {
			updateMessageIfNeeded();
			continue;
		}
		// If the stream isn't by a followed user and either:
		//   A: isn't for a followed game
		//   B: is for a followed game but doesn't have a keyword in the title
		// then delete the message:
		delete streamsChannelMessages[twitchUserId];
		streamsChannelMessagesToDelete.push(message);
	}

	// Send the request to delete any stream messages in the streams channel which
	// belong to streams that have ended:
	discordAPIPromises.push(
		safeBulkDelete(streamsChannelAPI, streamsChannelMessagesToDelete)
	);


	// If the user is blocked, or if there is already a message for this user
	// in the streams channel, don't bother posting another message for them:
	const anySingleStreamMessagePostedInStreamsChannel = (userId) => {
		const messages = singleStreamMessages[userId];
		if (messages === undefined) {
			return false;
		}
		return messages.some(messageData => messageData.channel === streamsChannel);
	};
	const streamBlockedOrPosted = (userId) => (
		blockedUsersIdSet.has(userId)
		|| singleStreamBlockedUsersIdSet.has(userId)
		|| userId in streamsChannelMessages
		|| anySingleStreamMessagePostedInStreamsChannel(userId)
	);

	// Fourth, we loop over followed games to check if any new messages need
	// to be posted in the streamsChannel:
	for (const gameId of followedGameIdSet) {
		const streams = gameIdToStreamsMap.get(gameId);
		if (streams === undefined) {
			continue;
		}
		for (const stream of streams) {
			if (streamBlockedOrPosted(stream.userId) || !hasKeyword(stream)) {
				continue;
			}
			discordAPIPromises.push(
				sendStreamMessage(streamsChannelAPI, stream, guildTwitchConfig)
			);
		}
	}

	// Fifth, we loop over followed users:
	for (const userId of followedUserIdSet) {
		if (streamBlockedOrPosted(userId)) {
			continue;
		}
		const stream = userIdToStreamMap.get(userId);
		discordAPIPromises.push(
			sendStreamMessage(streamsChannelAPI, stream, guildTwitchConfig)
		);
	}
	return await finishUpdating();
}

/**
 * Based on the "twitch" guild config data for each guild, posts new stream
 * messages to the streamsChannel, and edits/deletes old ones based on the
 * Twitch stream data and the config's followed data (followedGames,
 * keywords, and followedUsers). Also edits and deletes any
 * singleStreamMessages as needed.
 * @param {DJSClient} discordClient The Discord client through which to make
 * message send/edit/delete requests
 * @param {string[]} [guildIds] Optional. An array of guild Ids to check. By
 * default, all guild ids listed in the bot's overall config.json file are
 * checked.
 */
export async function updateStreamMessages(
	discordClient,
	guildIds = allGuildIds,
) {
	const {
		guildTwitchConfigs,
		userIdToStreamMap,
		gameIdToStreamsMap,
	} = await getMonitoredStreams(guildIds);

	// Rather than awaiting each message send/edit/delete request within the loop,
	// which would slow things down needlessly, just send all the requests and
	// await Promise.all() after the loop:
	const promises = [];

	// Send, edit, and delete messages based on live Twitch streams:
	for (const guildId of guildIds) {
		const guildTwitchConfig = guildTwitchConfigs.get(guildId);
		promises.push(updateGuildStreamMessages({
			discordClient,
			guildId,
			guildTwitchConfig,
			userIdToStreamMap,
			gameIdToStreamsMap,
		}));
	}
	// Wait for all the Discord API calls to complete:
	await Promise.all(promises);
}