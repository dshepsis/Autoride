// For miscellaneous commands which are mostly just for fun and don't serve a
// real purpose :)

// Subcommands: BORK, auride-says, etc.?

import { SlashCommandBuilder } from 'discord.js';

export const data = (new SlashCommandBuilder()
	.setName('misc')
	.setDescription('Miscellaneous commands which are mostly just for fun.')
	.addStringOption(option => option
		.setName('messages')
		.setDescription('Message ids separated by semicolon')
	)
);

// This command will only be visible and usable from the development guild
export const inDevelopment = true;

/**
 * @param { import("discord.js").CommandInteraction } interaction
 * @returns {Promise<void>}
 */
export async function execute(interaction) {
	// const content = 'BORK!';
	// return await interaction.reply({ content });
	const messagesStr = interaction.options.getString('messages');
	const messageIds = messagesStr.split(/\s*;\s*/g);
	const messages = await interaction.channel.bulkDelete(messageIds);
	await interaction.reply('Deleted these messages: ' + Array.from(messages.keys()));
}