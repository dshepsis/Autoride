const { SlashCommandBuilder } = require('@discordjs/builders');
const { MessageEmbed } = require('discord.js');
const { ChannelType } = require('discord-api-types/v9');
const privilegeLevels = require('../privilegeLevels');

const Keyv = require('keyv');

// Load URL database. This is used to store URLs contained in the requested
// message. These URLs are periodically checked by the
// monitorURLsForHTTPErrors.js routine to see if any of them give HTTP errors.
// If any of them do, notify the creator of the message.
const urlsDB = new Keyv(
	'sqlite://database.sqlite',
	{ namespace: 'guildResources' }
);
urlsDB.on('error', err => console.log(
	'Connection Error when searching for urlsDB',
	err
));

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

		// Check for URLs in the user's message, and ask to add them to the
		// database of monitored URL's if there are any:
		const urlObjs = [];
		const urlRegex = /\[(?<mask>[^\]]+)\]\((?<maskedUrl>https[^)]+)\)|(?<url>https:\/\/\S+)/g;
		console.log(`Checking for URL's in "${userContent}"`);
		for (const match of userContent.matchAll(urlRegex)) {
			const groups = match.groups;
			console.log('Found URL: ', groups);
			const urlObj = {
				channelId: userReply.channelId,
				userId: userReply.author.id,
			};
			if (groups.mask) {
				urlObj.url = groups.maskedUrl;
				urlObj.info = groups.mask;
			}
			else {
				urlObj.url = groups.url;
			}
			urlObjs.push(urlObj);
		}
		let urlsMonitoredMsg = '';
		if (urlObjs.length !== 0) {
			// @TODO: Maybe there should be some additional metadata here, to support
			// preventing multiple urlObjs having the same URL...
			await urlsDB.set(interaction.guildId, urlObjs);
			urlsMonitoredMsg = '\nAll URLs in the embed will be periodically checked for HTTP errors. You can manage this with the `/http-monitor` command.';
		}
		{
			const content = `Reply sent to ${channel}: ${embedMsg.url}${urlsMonitoredMsg}`;
			return userReply.reply({ content });
		}
	},
};