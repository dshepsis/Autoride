import { SlashCommandBuilder } from '@discordjs/builders';

export const data = (new SlashCommandBuilder()
	.setName('test')
	.setDescription('Crashes the bot to test pm2\'s automatic restart.')
	// .addStringOption(option => option
	// 	.setName('message-id')
	// 	.setDescription('The ID of the message you\'d like to delete')
	// 	.setRequired(true)
	// )
);

// This command will only be visible and usable from the development guild
export const inDevelopment = true;

export async function execute() {
	throw new Error('Intentionally crashing the bot...');
}