import { SlashCommandBuilder } from '@discordjs/builders';
import * as manageTwitchUtils from '../util/manageTwitchUtils.mjs';

export const data = (new SlashCommandBuilder()
	.setName('manage-twitch')
	.setDescription('Configure the Twitch stream monitoring feature')
	.addSubcommand(subcommand => subcommand
		.setName('set-streams-channel')
		.setDescription('Set which channel Twitch stream notifications will be sent to')
		.addChannelOption(option => option
			.setName('streams-channel')
			.setDescription('The channel Twitch stream notifications will be sent to')
			.setRequired(true)
		)
	)
	.addSubcommandGroup(subcommandGroup => subcommandGroup
		.setName('users')
		.setDescription('Manage which Twitch users\' streams are monitored.')
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
			.setName('list-followed')
			.setDescription('See the list of followed Twitch users for this guild')
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
		.addSubcommand(subcommand => subcommand
			.setName('list-blocked')
			.setDescription('See the list of followed Twitch users for this guild')
		)
	)
	.addSubcommandGroup(subcommandGroup => subcommandGroup
		.setName('games')
		.setDescription('Manage which Twitch games\' streams are monitored.')
		.addSubcommand(subcommand => subcommand
			.setName('follow')
			.setDescription('Add a Twitch game to the list of followed games')
			.addStringOption(option => option
				.setName('name')
				.setDescription('The Twitch game\'s name')
				.setRequired(true)
			)
		)
		.addSubcommand(subcommand => subcommand
			.setName('unfollow')
			.setDescription('Remove a Twitch game from the list of followed games')
			.addStringOption(option => option
				.setName('name')
				.setDescription('The Twitch game\'s name')
				.setRequired(true)
			)
		)
		.addSubcommand(subcommand => subcommand
			.setName('list-followed')
			.setDescription('See the list of followed Twitch games for this guild')
		)
	)
	.addSubcommandGroup(subcommandGroup => subcommandGroup
		.setName('required-tags')
		.setDescription('Manage which Twitch tags, if any, are required for a followed game stream to be reported')
		.addSubcommand(subcommand => subcommand
			.setName('set')
			.setDescription('Set the list of required tags')
			.addStringOption(option => option
				.setName('list')
				.setDescription('A list of tag names, exactly as listed on Twitch, separated by semicolons (";")')
				.setRequired(true)
			)
		)
		.addSubcommand(subcommand => subcommand
			.setName('clear')
			.setDescription('Remove all required tags, so that no specific tags are required for a game stream to be reported')
		)
		.addSubcommand(subcommand => subcommand
			.setName('list')
			.setDescription('See the list of required tags for this guild')
		)
	)
	.setDefaultPermission(false)
);

/**
 * @param { import("discord.js").CommandInteraction } interaction
 * @returns {Promise<void>}
 */
export async function execute(interaction) {
	await interaction.deferReply();
}