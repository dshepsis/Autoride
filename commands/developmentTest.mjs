import { SlashCommandBuilder } from '@discordjs/builders';

export const data = (new SlashCommandBuilder()
	.setName('test')
	.setDescription('Test whether this in-development command is available only in the dev server.')
);

// This command will only be visible and usable from the development guild
export const inDevelopment = true;

export async function execute(interaction) {
	const content = 'Hacked :D';
	return await interaction.reply({ content });
}