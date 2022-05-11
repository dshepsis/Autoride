import * as patterns from './schema-util/patterns.mjs';

export const name = 'twitch';

export const schema = {
	description: `An object containing various data/criteria for monitoring and
	sending messages about Twitch streams`,
	type: 'object',
	additionalProperties: false,
	required: [
		'streamsChannelMessages',
		'followedGames',
		'requiredTags',
		'followedUsers',
		'blockedUsers',
		'singleStreamBlockedUsers',
		'singleStreamMessages',
	],
	properties: {
		'streamsChannel': {
			description: `The snowflake Id of the discord channel in which to post
			messages about live streams. Not required, but no streams will be
			reported unless a channel is set using the /twitch-monitor command`,
			type: 'string',
			pattern: patterns.snowflake,
		},
		'streamsChannelMessages': {
			description: `An object mapping from Twitch user ids to an object
			containing data representing a message posted in the streamsChannel by the
			monitorTwitchStreams routine, which should be deleted or edited when the
			user stops streaming or changes stream info.`,
			type: 'object',
			additionalProperties: false,
			patternProperties: {
				[patterns.twitchUserId]: {
					description: `An object containing a Discord message id. as well as
					information on the embed posted for the stream so that the message
					can be edited if the streamer changes it`,
					type: 'object',
					additionalProperties: false,
					required: ['message', 'title', 'gameId'],
					properties: {
						'message': {
							description: `The id of the Discord message containing the to be
							deleted when the stream is over`,
							type: 'string',
							pattern: patterns.snowflake,
						},
						'title': {
							description: `The title of the Twitch stream, as shown in the
							embed`,
							type: 'string',
						},
						'gameId': {
							description: 'The Twitch id of the game shown in the embed',
							type: 'string',
							pattern: patterns.twitchGameId,
						},
					},
				},
			},
		},
		'followedGames': {
			description: `An object mapping from Twitch API game names to game ids,
			representing games for which streams with the required tags are
			reported.`,
			type: 'object',
			additionalProperties: {
				description: 'A Twitch API game id',
				type: 'string',
				pattern: patterns.twitchGameId,
			},
		},
		'requiredTags': {
			description: `An object mapping from Twitch API tag names to tag ids,
			representing tags which streams of the followedGames must have in order
			to be reported.`,
			type: 'object',
			additionalProperties: {
				description: 'A Twitch API tag id',
				type: 'string',
				pattern: patterns.twitchTagId,
			},
		},
		'followedUsers': {
			description: `An object mapping from Twitch usernames to user ids, 
			representing users whose streams are reported regardless of which games
			they are playing and what tags they use.`,
			type: 'object',
			additionalProperties: {
				description: 'A Twitch user id',
				type: 'string',
				pattern: patterns.twitchUserId,
			},
		},
		'blockedUsers': {
			description: `An object mapping from Twitch usernames to user ids, 
			representing users whose streams will not be reported, regardless of
			whether they are streaming a followed game or not. Users can be blocked/
			unblocked using the corresponding /manage-twitch subcommands.`,
			type: 'object',
			additionalProperties: {
				description: 'A Twitch user id',
				type: 'string',
				pattern: patterns.twitchUserId,
			},
		},
		'singleStreamBlockedUsers': {
			description: `An object mapping from Twitch usernames to user ids, 
			representing users whose current stream will not be reported in the
			streamsChannel, but who will be "unblocked" when they are next found to be
			offline. This is used to prevent the bot from reposting a stream message
			which has been deleted by a server moderator. The /manage-twitch unblock
			command will remove users from both this list and the regular blockedUsers
			list.`,
			type: 'object',
			additionalProperties: {
				description: 'A Twitch user id',
				type: 'string',
				pattern: patterns.twitchUserId,
			},
		},
		'singleStreamMessages': {
			description: `An object mapping from Twitch user ids to an array of
			objects containing data representing messages posted via the /twitch-post
			command, which should be deleted routine when the user stops streaming or
			edited by the monitorTwitchStreams when they change stream info. The key
			difference between these messages and streamsChannelMessages, is that
			these messages are not checked against the followedGames/requiredTags
			list to see if they should be deleted.`,
			type: 'object',
			additionalProperties: false,
			patternProperties: {
				[patterns.twitchUserId]: {
					description: `An array of objects containing data for Discord messages
					to be deleted when the user stops streaming or edited if they change
					stream info during a stream`,
					type: 'array',
					uniqueItems: true,
					items: {
						description: `An object containing a Discord channel and message
						id, as well as information on the embed posted for the stream so
						that the message can be edited if the streamer changes it.`,
						type: 'object',
						additionalProperties: false,
						required: ['channel', 'message', 'title', 'gameId'],
						properties: {
							'channel': {
								description: `The id of the Discord channel containing the
								message to delete when the stream is over`,
								type: 'string',
								pattern: patterns.snowflake,
							},
							'message': {
								description: `The id of the Discord message containing the to be
								deleted when the stream is over`,
								type: 'string',
								pattern: patterns.snowflake,
							},
							'title': {
								description: `The title of the Twitch stream, as shown in the
								embed`,
								type: 'string',
							},
							'gameId': {
								description: 'The Twitch id of the game shown in the embed',
								type: 'string',
								pattern: patterns.twitchGameId,
							},
						},
					},
				},
			},
		},
	},
};

/**
 * @typedef { import("discord.js").Client } DJSClient
 * @typedef { import("discord.js").Guild } Guild
 * @typedef { import("discord.js").BaseGuildTextChannel } BaseGuildTextChannel
 * @typedef { import("discord.js").Message } Message
 * @typedef { import("@twurple/api").HelixStream } HelixStream
 * @typedef { import("@twurple/api").HelixUser } HelixUser
 * @typedef { import("@twurple/api").HelixGame } HelixGame
 * @typedef { import("@twurple/api").HelixTag } HelixTag
 * @typedef {object} TwitchConfig
 * @prop {string} [streamsChannel] The id of the Discord channel to which
 * stream notifications should be posted
 * @prop { {[tagName: string]: HelixGame} } followedGames
 */

/**
 * An object containing a Discord message id. as well as information on the
 * embed posted for the stream so that the message can be edited if the streamer
 * changes it.
 * @typedef {object} StreamsChannelMessage
 * @prop {string} message The id of the Discord message containing the to be
 * deleted when the stream is over
 * @prop {string} title The title of the Twitch stream, as shown in the embed
 * @prop {string} gameId The Twitch id of the game shown in the embed
 */
/**
 * An object containing a Discord channel and message id, as well as information
 * on the embed posted for the stream so that the message can be edited if the
 * streamer changes it.
 * @typedef {object} SingleStreamMessage
 * @prop {string} channel The id of the Discord channel containing the message
 * to delete when the stream is over
 * @prop {string} message The id of the Discord message containing the to be
 * deleted when the stream is over
 * @prop {string} title The title of the Twitch stream, as shown in the embed
 * @prop {string} gameId The Twitch id of the game shown in the embed
 */
/**
 * An object containing various data/criteria for monitoring and sending
 * messages about Twitch streams
 * @typedef {object} TwitchConfig
 * @prop {string} [streamsChannel] The snowflake Id of the discord channel in
 * which to post messages about live streams. Not required, but no streams will
 * be reported unless a channel is set using the /twitch-monitor command
 * @prop {{[userId: string]: StreamsChannelMessage}} streamsChannelMessages An
 * object mapping from Twitch user ids to an object containing data representing
 * a message posted in the streamsChannel by the monitorTwitchStreams routine,
 * which should be deleted or edited when the user stops streaming or changes
 * stream info.
 * @prop {{[gameName: string]: string}} followedGames An object mapping from
 * Twitch API game names to game ids, representing games for which streams with
 * the required tags are reported.
 * @prop {{[tagName: string]: string}} requiredTags An object mapping from
 * Twitch API tag names to tag ids, representing tags which streams of the
 * followedGames must have in order to be reported.
 * @prop {{[userName: string]: string}} followedUsers An object mapping from
 * Twitch usernames to user ids, representing users whose streams are reported
 * regardless of which games they are playing and what tags they use.
 * @prop {{[userName: string]: string}} blockedUsers An object mapping from
 * Twitch usernames to user ids, representing users whose streams will not be
 * reported, regardless of whether they are streaming a followed game or not.
 * Users can be blocked/ unblocked using the corresponding /manage-twitch
 * subcommands.
 * @prop {{[userName: string]: string}} singleStreamBlockedUsers An object
 * mapping from Twitch usernames to user ids, representing users whose current
 * stream will not be reported in the streamsChannel, but who will be
 * "unblocked" when they are next found to be offline. This is used to prevent
 * the bot from reposting a stream message which has been deleted by a server
 * moderator. The /manage-twitch unblock command will remove users from both
 * this list and the regular blockedUsers list.
 * @prop {{[userId: string]: SingleStreamMessage[]}} singleStreamMessages An
 * object mapping from Twitch user ids to an array of objects containing data
 * representing messages posted via the /twitch-post command, which should be
 * deleted routine when the user stops streaming or edited by the
 * monitorTwitchStreams when they change stream info. The key difference between
 * these messages and streamsChannelMessages, is that these messages are not
 * checked against the followedGames/requiredTags list to see if they should be
 * deleted.
 */

/**
 * @returns {TwitchConfig} A value which matches the Twitch scheme while being
 * as empty as possible.
 */
export function makeDefault() {
	return {
		streamsChannelMessages: {},
		followedGames: {},
		requiredTags: {},
		followedUsers: {},
		blockedUsers: {},
		singleStreamBlockedUsers: {},
		singleStreamMessages: {},
	};
}

/** @type {TwitchConfig} */
export const example = {
	streamsChannel: '123456789123456789',
	streamsChannelMessages: {
		'60360743': {
			message: '123456789123456787',
			title: 'Okami NG Any%',
			gameId: '467024621',
		},
	},
	followedGames: {
		'Ōkami': '18791',
		'Ōkami HD': '467024621',
		'Ōkamiden': '25256',
	},
	requiredTags: {
		'Any%': 'c9193f35-a88f-4f03-af99-b73fe0db60f3',
		'Speedrun': '7cefbf30-4c3e-4aa7-99cd-70aabb662f27',
		'WR Attempts': '2b19c8f9-695f-4ea1-a5fe-eba176770dbc',
		'TAS': '0b83a789-5f6a-45f0-b6a3-a56926b6f8b5',
		'PB Attempts': '77a928f7-39da-4dad-9d81-3e6bd7a36e04',
		'Glitch Hunting': 'd6de2e71-689a-4c47-ad61-6ec6182f9491',
		'Glitched': '5788eae8-312d-43b5-a0b6-465eda087617',
		'Low%': 'a716383e-a9ff-4531-be5f-e25cdd7585d8',
	},
	followedUsers: {
		'loveauride': '60360743',
	},
	blockedUsers: {
		'some_spammer_user': '55555555',
	},
	singleStreamBlockedUsers: {
		'used_wrong_stream_info': '44444444',
	},
	singleStreamMessages: {
		'60360743': [
			{
				channel: '123456789123456780',
				message: '123456789123456781',
				title: 'Okami NG Any%',
				gameId: '467024621',
			},
		],
	},
};