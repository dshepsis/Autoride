import { SlashCommandBuilder } from '@discordjs/builders';
import { MessageEmbed } from 'discord.js';
import { ChannelType } from 'discord-api-types/v9';
import { addUrlObjs } from '../util/manageMonitoredURLs.mjs';
import { awaitCommandReply, USER_REPLY } from './command-util/awaitCommandReply.mjs';
import { awaitCommandConfirmation, USER_CONFIRM } from './command-util/awaitCommandConfirmation.mjs';


export const data = (new SlashCommandBuilder()
	.setName('embed-message')
	.setDescription('Reply to the bot with the message you want to embed in the given channel.')
	.addChannelOption(option => option
		.setName('channel')
		.setDescription('What channel to repost the message to.')
		.addChannelTypes([ChannelType.GuildNews, ChannelType.GuildText])
	)
	.setDefaultPermission(false)
);
export async function execute(interaction) {
	const channel = (
		interaction.options.getChannel('channel') ?? interaction.channel
	);

	const { responseType, userReply } = await awaitCommandReply({
		interaction,
		commandName: 'embed-message',
		timeout_ms: 30_000,
		requestReplyContent: `Please reply to this message with the contents you want to embed in ${channel}.`,
	});
	if (responseType !== USER_REPLY) {
		return;
	}

	const userContent = userReply.content;
	const embed = (new MessageEmbed()
		.setDescription(userContent)
	);
	const embedMsg = await channel.send({ embeds: [embed] });

	// Check for URLs in the user's message. Any URLs found are added to a
	// database (via manageUrlsDB) which is periodically checked by
	// routines/monitorURLsForHTTPErrors to see if they give errors when an
	// HTTPS request is made to them. This helps users know when they need to
	// edit their embed messages to fix broken links:
	let anyUrls = false;
	const urlRegex = /\[(?<mask>[^\]]+)\]\((?<maskedUrl>https?[^)]+)\)|(?<url>https?:\/\/\S+)/g;
	const urlObjsToAdd = [];
	for (const match of userContent.matchAll(urlRegex)) {
		anyUrls = true;
		const groups = match.groups;
		const channelId = userReply.channelId;
		const userId = userReply.author.id;
		const info = groups.mask;
		const url = (info) ? groups.maskedUrl : groups.url;

		const urlObj = {
			url,
			enabled: true,
			notifyChannels: {
				[channelId]: {
					userIds: [userId],
					info,
				},
			},
		};
		urlObjsToAdd.push(urlObj);
	}
	if (!anyUrls) {
		const content = `Reply sent to ${channel}: <${embedMsg.url}>`;
		return await userReply.reply({ content });
	}
	// If there were any URLs in the message we just embeded, ask the user if they
	// want to monitor these URLs.
	const {
		responseType: buttonResponseType,
		buttonInteraction,
	} = await awaitCommandConfirmation({
		interaction,
		messageToReplyTo: userReply,
		commandName: 'embed-message',
		warningContent: `Reply sent to ${channel}: <${embedMsg.url}>.\nSome URL's were found in the message. Do you want to add them to the list of URLs monitored for HTTP errors? You can manage these using the \`/http-monitor\` command. If they're already being monitored, the existing entries will be updated to notify you in this channel.`,
		buttonStyle: 'PRIMARY',
		confirmContent: null,
		confirmButtonLabel: 'Yes, monitor the URLs in my message.',
		cancelButtonLabel: 'No, don\'t add URL monitoring.',
	});
	if (buttonResponseType !== USER_CONFIRM) {
		// If the user pressed the cancel button or let the confirmation dialog
		// time out, just leave in-place the default replies of
		// awaitCommandConfirmation.
		return;
	}
	await addUrlObjs(interaction.guildId, urlObjsToAdd);
	const content = 'All URLs in the embed will be periodically checked for HTTP errors. You can manage this with the `/http-monitor` command.';
	return await buttonInteraction.update({ content, components: [] });
}