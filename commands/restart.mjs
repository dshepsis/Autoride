import { SlashCommandBuilder } from '@discordjs/builders';

export const data = (new SlashCommandBuilder()
	.setName('restart')
	.setDescription('Terminates and restarts the bot.')
);

// This command will only be visible and usable from the development guild
export const inDevelopment = true;

export async function execute(interaction) {
	await interaction.reply('Restarting...');
	process.kill(process.pid, 'SIGTERM');
}