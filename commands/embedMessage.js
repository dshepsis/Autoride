const { SlashCommandBuilder } = require('@discordjs/builders');
const { MessageEmbed } = require('discord.js');
const { ChannelType } = require('discord-api-types/v9');
const privilegeLevels = require('../privilegeLevels');
const { addUrlObj } = require('../util/manageUrlsDB');

module.exports = {
	data: (new SlashCommandBuilder()
		.setName('embed-message')
		.setDescription('Reply to the bot with the message you want to embed in the given channel.')
		.addChannelOption(option => option
			.setName('channel')
			.setDescription('What channel to repost the message to.')
			.addChannelType(ChannelType.GuildText)
		)
		.setDefaultPermission(false)
	),
	minimumPrivilege: privilegeLevels.byName.ADMIN,
	async execute(interaction) {
		const channel = (
			interaction.options.getChannel('channel') ?? interaction.channel
		);
		{
			const content = `Please reply to this message with the contents you want to embed in ${channel}.`;
			await interaction.reply({ content });
		}

		const botMessage = await interaction.fetchReply();
		const REPLY_TIME_LIMIT = 30_000; // milliseconds
		const filter = message => (
			(botMessage.id === message?.reference?.messageId)
			&& (interaction.user.id === message?.author.id)
		);
		let userReply;
		try {
			const collected = await interaction.channel.awaitMessages({
				filter,
				max: 1,
				time: REPLY_TIME_LIMIT,
				errors: ['time'],
			});
			userReply = collected.first();
		}
		catch (error) {
			const content = `This \`/embed-message\` command timed out after ${
				Math.floor(REPLY_TIME_LIMIT / 1000)
			} seconds. Please dismiss this message and use the command again if needed.`;
			try {
				// This may error if the bot's reply was deleted:
				return interaction.editReply({ content });
			}
			catch (editError) {
				return null;
			}
		}

		const userContent = userReply.content;
		const embed = (new MessageEmbed()
			.setDescription(userContent)
		);
		const embedMsg = await channel.send({ embeds: [embed] });

		// Check for URLs in the user's message. Any URLs found are added to a
		// database (via manageUrlsDB.js) which is periodically checked by
		// routines/monitorURLsForHTTPErrors.js to see if they give errors when an
		// HTTPS request is made to them. This helps users know when they need to
		// edit their embed messages to fix broken links:
		let anyUrls = false;
		const urlRegex = /\[(?<mask>[^\]]+)\]\((?<maskedUrl>https[^)]+)\)|(?<url>https:\/\/\S+)/g;
		const urlAddPromises = [];
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
			urlAddPromises.push(addUrlObj(interaction.guildId, urlObj));
		}
		let urlsMonitoredMsg = '';
		if (anyUrls) {
			urlsMonitoredMsg = '\nAll URLs in the embed will be periodically checked for HTTP errors. You can manage this with the `/http-monitor` command.';
			await Promise.all(urlAddPromises);
		}
		{
			const content = `Reply sent to ${channel}: ${embedMsg.url}${urlsMonitoredMsg}`;
			return userReply.reply({ content });
		}
	},
};