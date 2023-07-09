import { SlashCommandBuilder } from 'discord.js';

export const data = (new SlashCommandBuilder()
	.setName('restart')
	.setDescription('Terminates and restarts the bot.')
	.setDefaultMemberPermissions(0)
);

// This command will only be visible and usable from the development guild
export const inDevelopment = true;


/**
 * @param { import("discord.js").CommandInteraction } interaction
 * @returns {Promise<any>}
 */
export async function execute(interaction) {
	await interaction.reply('Restarting...');
	process.kill(process.pid, 'SIGTERM');
}