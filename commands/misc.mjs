// For miscellaneous commands which are mostly just for fun and don't serve a
// real purpose :)

// Subcommands: BORK, auride-says, etc.?

import { SlashCommandBuilder } from '@discordjs/builders';

export const data = (new SlashCommandBuilder()
	.setName('misc')
	.setDescription('Miscellaneous commands which are mostly just for fun.')
);

// This command will only be visible and usable from the development guild
export const inDevelopment = true;

export async function execute(interaction) {
	const content = 'BORK!';
	return interaction.reply({ content });
}