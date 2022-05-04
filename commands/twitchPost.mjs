import { SlashCommandBuilder } from '@discordjs/builders';
import { getUserStream, makeStreamEmbed, monitorStreamMessage } from '../util/manageTwitchUtils.mjs';

export const data = (new SlashCommandBuilder()
	.setName('twitch-post')
	.setDescription('Post a message for a Twitch stream, then delete it when the stream ends.')
	.addStringOption(option => option
		.setName('stream')
		.setDescription('The username or URL of the live Twitch stream.')
		.setRequired(true)
	)
	.addBooleanOption(option => option
		.setName('do-not-delete')
		.setDescription('False by default. If true, the posted message won\'t be deleted when the strea ends.')
	)
);

const twitchURLOrUsernameRegex = /^\s*(?:https?:\/\/www\.twitch\.tv\/)?([A-Za-z0-9]\w{3,24})\/?\s*$/;

export async function execute(interaction) {
	const streamStr = interaction.options.getString('stream');
	const doNotDelete = interaction.options.getBoolean('do-not-delete');
	const usernameMatch = twitchURLOrUsernameRegex.exec(streamStr);
	if (usernameMatch === null) {
		const content = 'Error: Invalid Twitch URL/username.';
		return await interaction.reply({ content, ephemeral: true });
	}
	const username = usernameMatch[1];
	const stream = await getUserStream(username);
	if (stream === null) {
		const content = `Error: The user \`${username}\` isn't currently live on Twitch.`;
		return await interaction.reply({ content, ephemeral: true });
	}
	const embed = await makeStreamEmbed(stream);
	const botMsg = await interaction.reply({ embeds: [embed], fetchReply: true });
	if (!doNotDelete) {
		await monitorStreamMessage(stream, botMsg);
	}
	// If do-not-delete is set to true, then don't add the message to the list of
	// monitored messages, so it won't get deleted by the monitorTwitchStreams
	// routine when the stream ends.
}