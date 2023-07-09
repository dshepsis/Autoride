import * as twitchUtils from '../util/manageTwitchUtils.mjs';
import * as patterns from '../guild-config-schema/schema-util/patterns.mjs';
import { SlashCommandBuilder, ChannelType, escapeMarkdown } from 'discord.js';

const twitchUsernameRegex = new RegExp(patterns.twitchUsername, 'u');
function isValidTwitchUsername(username) {
	return twitchUsernameRegex.test(username);
}

export const data = (new SlashCommandBuilder()
	.setName('manage-twitch')
	.setDescription('Configure the Twitch stream monitoring feature')
	.addSubcommand(subcommand => subcommand
		.setName('set-streams-channel')
		.setDescription('Set which channel Twitch stream notifications will be sent to')
		.addChannelOption(option => option
			.setName('streams-channel')
			.setDescription('The channel Twitch stream notifications will be sent to')
			.addChannelTypes(ChannelType.GuildAnnouncement, ChannelType.GuildText)
			.setRequired(true)
		)
	)
	.addSubcommand(subcommand => subcommand
		.setName('clear-stream-data')
		.setDescription('Clear all data associated with live streams (stream messages, single-stream blocked users, etc.)')
	)
	.addSubcommandGroup(subcommandGroup => subcommandGroup
		.setName('users')
		.setDescription('Manage which Twitch users\' streams are monitored.')
		.addSubcommand(subcommand => subcommand
			.setName('list-followed')
			.setDescription('See the list of followed Twitch users for this guild')
		)
		.addSubcommand(subcommand => subcommand
			.setName('list-blocked')
			.setDescription('See the list of followed Twitch users for this guild')
		)
		.addSubcommand(subcommand => subcommand
			.setName('follow')
			.setDescription('Add a Twitch user to the list of followed users')
			.addStringOption(option => option
				.setName('username')
				.setDescription('The Twitch user\'s name')
				.setRequired(true)
			)
		)
		.addSubcommand(subcommand => subcommand
			.setName('unfollow')
			.setDescription('Remove a Twitch user from the list of followed users')
			.addStringOption(option => option
				.setName('username')
				.setDescription('The Twitch user\'s name')
				.setRequired(true)
			)
		)
		.addSubcommand(subcommand => subcommand
			.setName('block')
			.setDescription('Add a Twitch user to the list of blocked users')
			.addStringOption(option => option
				.setName('username')
				.setDescription('The Twitch user\'s name')
				.setRequired(true)
			)
		)
		.addSubcommand(subcommand => subcommand
			.setName('unblock')
			.setDescription('Remove a Twitch user from the list of blocked users')
			.addStringOption(option => option
				.setName('username')
				.setDescription('The Twitch user\'s name')
				.setRequired(true)
			)
		)
	)
	.addSubcommandGroup(subcommandGroup => subcommandGroup
		.setName('games')
		.setDescription('Manage which Twitch games\' streams are monitored.')
		.addSubcommand(subcommand => subcommand
			.setName('list-followed')
			.setDescription('See the list of followed Twitch games for this guild')
		)
		.addSubcommand(subcommand => subcommand
			.setName('follow')
			.setDescription('Add a Twitch game to the list of followed games')
			.addStringOption(option => option
				.setName('game-name')
				.setDescription('The Twitch game\'s name')
				.setRequired(true)
			)
		)
		.addSubcommand(subcommand => subcommand
			.setName('unfollow')
			.setDescription('Remove a Twitch game from the list of followed games')
			.addStringOption(option => option
				.setName('game-name')
				.setDescription('The Twitch game\'s name')
				.setRequired(true)
			)
		)
	)
	.addSubcommandGroup(subcommandGroup => subcommandGroup
		.setName('keywords')
		.setDescription('Manage which keywords, if any, must be in a followed game\'s stream title for it to be reported')
		.addSubcommand(subcommand => subcommand
			.setName('list')
			.setDescription('See the list of keywords for this guild')
		)
		.addSubcommand(subcommand => subcommand
			.setName('set')
			.setDescription('Set the list of keywords, overwriting the existing one')
			.addStringOption(option => option
				.setName('keyword-list')
				.setDescription('A list of keyword strings separated by semicolons (";")')
				.setRequired(true)
			)
		)
		.addSubcommand(subcommand => subcommand
			.setName('add')
			.setDescription('Add a single keyword')
			.addStringOption(option => option
				.setName('keyword')
				.setDescription('A keyword string to add')
				.setRequired(true)
			)
		)
		.addSubcommand(subcommand => subcommand
			.setName('remove')
			.setDescription('Remove a single keyword')
			.addStringOption(option => option
				.setName('keyword')
				.setDescription('A keyword string to remove')
				.setRequired(true)
			)
		)
		.addSubcommand(subcommand => subcommand
			.setName('clear')
			.setDescription('Remove all keywords, so all streams of followed games are reported')
		)
	)
	.setDefaultMemberPermissions(0)
);

/**
 * @param {string[]} strings
 * @returns {string}
 */
function unorderedList(strings) {
	return '\n- ' + strings.join('\n- ');
}

/**
 * @param { import("discord.js").CommandInteraction } interaction
 * @returns {Promise<void>}
 */
export async function execute(interaction) {
	await interaction.deferReply();

	const { guildId, options } = interaction;

	const subcommandGroup = options.getSubcommandGroup(false); // Optional
	const subcommand = options.getSubcommand(true);
	if (subcommandGroup === null) {
		if (subcommand === 'set-streams-channel') {
			const channel = options.getChannel('streams-channel', true);
			await twitchUtils.setStreamsChannel(guildId, channel.id);
			const content = `Success! Twitch stream messages for followed users/games will now be sent to ${channel}.`;
			return await interaction.editReply({ content });
		}
		if (subcommand === 'clear-stream-data') {
			await twitchUtils.clearStreamData(guildId);
			const content = 'Cleared all data for currently live streams. Streams messages should be reposted within the next minute or so.';
			return await interaction.editReply({ content });
		}
	}

	if (subcommandGroup === 'users') {
		if (subcommand === 'list-followed') {
			const usernames = await twitchUtils.getFollowedUserNames(guildId);
			const content = ((usernames.length > 0)
				? `These users' streams are currently being followed:${unorderedList(usernames)}`
				: 'There are currently no followed Twitch users in this guild.'
			);
			return await interaction.editReply({ content });
		}

		if (subcommand === 'list-blocked') {
			const usernames = await twitchUtils.getBlockedUserNames(guildId);
			const content = ((usernames.length > 0)
				? `These users are currently blocked from having their streams reported:${unorderedList(usernames)}`
				: 'There are currently no blocked Twitch users in this guild.'
			);
			return await interaction.editReply({ content });
		}

		// All other `users` subcommands require a username parameter, so just get
		// and validate it up-front:
		const twitchUsername = (
			options.getString('username', true).trim().toLowerCase()
		);
		if (!isValidTwitchUsername(twitchUsername)) {
			const content = 'The given username is not a valid Twitch username. No changes were made.';
			return await interaction.editReply({ content, ephemeral: true });
		}

		if (subcommand === 'follow') {
			const result = await twitchUtils.followUser(guildId, twitchUsername);
			if (result === twitchUtils.USER_NOT_FOUND) {
				const content = `Couldn't follow "${twitchUsername}" because no such user was found. No changes were made.`;
				return await interaction.editReply({ content, ephemeral: true });
			}
			if (result === twitchUtils.USER_ALREADY_FOLLOWED) {
				const content = `The user "${twitchUsername}" is already being followed. No changes were made.`;
				return await interaction.editReply({ content, ephemeral: true });
			}
			const content = `Successfully followed "${result.displayName}".`;
			return await interaction.editReply({ content });
		}

		if (subcommand === 'unfollow') {
			const result = await twitchUtils.unfollowUser(guildId, twitchUsername);
			if (result === twitchUtils.USER_NOT_FOLLOWED) {
				const content = `The user "${twitchUsername}" was already not being followed. No changes were made.`;
				return await interaction.editReply({ content, ephemeral: true });
			}
			const content = `Successfully unfollowed "${twitchUsername}".`;
			return await interaction.editReply({ content });
		}

		if (subcommand === 'block') {
			const result = await twitchUtils.blockUser(guildId, twitchUsername);
			if (result === twitchUtils.USER_NOT_FOUND) {
				const content = `Couldn't block "${twitchUsername}" because no such user was found. No changes were made.`;
				return await interaction.editReply({ content, ephemeral: true });
			}
			if (result === twitchUtils.USER_ALREADY_BLOCKED) {
				const content = `The user "${twitchUsername}" is already blocked. No changes were made.`;
				return await interaction.editReply({ content, ephemeral: true });
			}
			const content = `Successfully blocked "${result.displayName}".`;
			return await interaction.editReply({ content });
		}
		if (subcommand === 'unblock') {
			const result = await twitchUtils.unblockUser(guildId, twitchUsername);
			if (result === twitchUtils.USER_NOT_BLOCKED) {
				const content = `The user "${twitchUsername}" was already not being blocked. No changes were made.`;
				return await interaction.editReply({ content, ephemeral: true });
			}
			const content = `Successfully unblocked "${twitchUsername}".`;
			return await interaction.editReply({ content });
		}
		throw new Error(`Unknkown subcommand /manage-twitch users ${subcommand}!`);
	} // End "users" subcommand group

	if (subcommandGroup === 'games') {
		if (subcommand === 'list-followed') {
			const gameNames = await twitchUtils.getFollowedGameNames(guildId);
			const content = ((gameNames.length > 0)
				? `These games' streams are currently being followed:${unorderedList(gameNames)}`
				: 'There are currently no followed Twitch games in this guild.'
			);
			return await interaction.editReply({ content });
		}
		const twitchGameName = options.getString('game-name', true);
		if (twitchGameName.length > 200) {
			const content = 'The given game name is too long! No changes were made.';
			return await interaction.editReply({ content, ephemeral: true });
		}
		const sanitizedGameName = escapeMarkdown(twitchGameName).replaceAll('`', '\\`');
		const allowedMentions = { parse: [] }; // Prevent injection of @mentions

		if (subcommand === 'follow') {
			const result = await twitchUtils.followGame(guildId, twitchGameName);
			if (result === twitchUtils.GAME_NOT_FOUND) {
				const content = `Couldn't follow "${sanitizedGameName}" because no such game was found. Try to find the exact game name using https://www.igdb.com/. No changes were made.`;
				return await interaction.editReply(
					{ content, ephemeral: true, allowedMentions }
				);
			}
			if (result === twitchUtils.GAME_ALREADY_FOLLOWED) {
				const content = `The game "${sanitizedGameName}" is already being followed. No changes were made.`;
				return await interaction.editReply(
					{ content, ephemeral: true, allowedMentions }
				);
			}
			const sanitizedTwitchGameName = (
				escapeMarkdown(result.name).replaceAll('`', '\\`')
			);
			const content = `Successfully followed "${sanitizedTwitchGameName}".`;
			return await interaction.editReply({ content, allowedMentions });
		}

		if (subcommand === 'unfollow') {
			const result = await twitchUtils.unfollowGame(guildId, twitchGameName);
			if (result === twitchUtils.GAME_NOT_FOLLOWED) {
				const content = `The game "${sanitizedGameName}" was already not being followed. No changes were made.`;
				return await interaction.editReply(
					{ content, ephemeral: true, allowedMentions }
				);
			}
			const content = `Successfully unfollowed "${sanitizedGameName}".`;
			return await interaction.editReply({ content, allowedMentions });
		}
		throw new Error(`Unknkown subcommand /manage-twitch users ${subcommand}!`);
	} // End "games" subcommand group

	if (subcommandGroup === 'keywords') {
		if (subcommand === 'list') {
			const keywords = await twitchUtils.getKeywords(guildId);

			const content = ((keywords.length > 0)
				? `At least one of these keywords must be in the title for a followed-games' streams to be reported:${unorderedList(keywords)}`
				: 'There are currently no required keywords for Twitch streams of followed games to be reported in this guild.'
			);
			return await interaction.editReply({ content });
		}

		if (subcommand === 'set') {
			const keywordList = options.getString('keyword-list', true);
			const keywords = Array.from(new Set(
				keywordList.split(';').map(k => k.trim()).filter(k => k.length)
			));
			await twitchUtils.setKeywords(guildId, keywords);
			const content = ((keywords.length > 0)
				? `The following keywords are now required in titles for streams of followed games to be reported:${unorderedList(keywords)}`
				: 'The list of title keywords was cleared. This means all followed-games\' streams will be reported from now on.'
			);
			return await interaction.editReply({ content });
		}

		if (subcommand === 'add') {
			const newKeyword = options.getString('keyword', true).trim();
			if (newKeyword.length === 0) {
				const content = 'You cannot add an empty keyword. No changes were made.';
				return await interaction.editReply({ content });
			}
			const currKeywords = await twitchUtils.getKeywords(guildId);
			const keywordSet = new Set(currKeywords);
			if (keywordSet.has(newKeyword)) {
				const content = `"${newKeyword}" is already a keyword. No changes were made.`;
				return await interaction.editReply({ content });
			}
			keywordSet.add(newKeyword);
			const keywords = Array.from(keywordSet);
			await twitchUtils.setKeywords(guildId, keywords);
			const content = `"${newKeyword}" was added. The following keywords are now required in titles for streams of followed games to be reported:${unorderedList(keywords)}`;
			return await interaction.editReply({ content });
		}

		if (subcommand === 'remove') {
			const remKeyword = options.getString('keyword', true).trim();
			if (remKeyword.length === 0) {
				const content = 'You cannot remove an empty keyword. No changes were made.';
				return await interaction.editReply({ content });
			}
			const currKeywords = await twitchUtils.getKeywords(guildId);
			const keywordSet = new Set(currKeywords);
			if (!keywordSet.has(remKeyword)) {
				const content = `"${remKeyword}" is already not a keyword. No changes were made.`;
				return await interaction.editReply({ content });
			}
			keywordSet.delete(remKeyword);
			const keywords = Array.from(keywordSet);
			await twitchUtils.setKeywords(guildId, keywords);
			const content = `"${remKeyword}" was removed. The following keywords are now required in titles for streams of followed games to be reported:${unorderedList(keywords)}`;
			return await interaction.editReply({ content });
		}

		if (subcommand === 'clear') {
			await twitchUtils.setKeywords(guildId, []);
			const content = 'The list of title keywords was cleared. This means all followed-games\' streams will be reported from now on.';
			return await interaction.editReply({ content });
		}
		throw new Error(`Unknkown subcommand /manage-twitch users ${subcommand}!`);
	}
	throw new Error(`Unknkown subcommand group /manage-twitch ${subcommandGroup}!`);
}