import { getVideo } from '../util/manageTwitchUtils.mjs';
import { SlashCommandBuilder, escapeMarkdown } from 'discord.js';

export const data = (new SlashCommandBuilder()
	.setName('is-twitch-highlight')
	.setDescription('Check if a Twitch.tv video URL is a higlight (permanently hosted) and get other info.')
	.addStringOption(option => option
		.setName('url')
		.setDescription('The URL of the Twitch video.')
		.setRequired(true)
	)
);

/**
 * @param { import("discord.js").CommandInteraction } interaction
 * @returns {Promise<any>}
 */
export async function execute(interaction) {
	const urlStr = interaction.options.getString('url');
	let videoURL;
	try {
		videoURL = new URL(urlStr);
	}
	catch (invalidURLError) {
		const content = 'Error: This is an invalid URL.';
		return await interaction.reply({ content, ephemeral: true });
	}
	if (!/^https?:\/\/(www\.)?twitch\.tv$/.test(videoURL.origin)) {
		const content = 'Error: This is not a valid twitch.tv URL.';
		return await interaction.reply({ content, ephemeral: true });
	}
	const pathMatch = /^\/videos\/(\d+)\/?$/.exec(videoURL.pathname);
	if (pathMatch === null) {
		const content = 'Error: This is not a valid twitch video URL. Expecting a URL of the format `https://www.twitch.tv/videos/1234567890`.';
		return await interaction.reply({ content, ephemeral: true });
	}

	const videoId = pathMatch[1];
	let videoData, content;

	// Defer reply here just in case getVideo is really slow (v unlikely);
	await interaction.deferReply({ ephemeral: true });
	try {
		videoData = await getVideo(videoId);
		content = `The given twitch VOD is a ${videoData.duration} ${videoData.isPublic ? 'public' : 'privated'} ${videoData.type} by ${videoData.userDisplayName} with title "${escapeMarkdown(videoData.title)}" published on ${videoData.publishDate.toLocaleDateString('en-GB', { dateStyle: 'long' })}.`;
	}
	catch (videoNotFoundError) {
		content = 'Error: The given video was unavailable/not found.';
	}
	return await interaction.editReply({ content });
}