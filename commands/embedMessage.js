const { SlashCommandBuilder } = require('@discordjs/builders');
const { MessageEmbed } = require('discord.js');
const privilegeLevels = require('../privilegeLevels');

function getMessageLink(message) {
	return `https://discord.com/channels/${message.guildId}/${message.channelId}/${message.id}`;
}

module.exports = {
	data: (new SlashCommandBuilder()
		.setName('embed-message')
		.setDescription('Reply to the bot with the message you want to embed in the given channel.')
		.addChannelOption(option => option
			.setName('channel')
			.setDescription('What channel to repost the message to.')
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
		const filter = message => (botMessage.id === message?.reference?.messageId);
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

		const embed = (new MessageEmbed()
			.setDescription(userReply.content)
		);
		const embedMsg = await channel.send({ embeds: [embed] });
		{
			const content = `Reply sent to ${channel}: ${getMessageLink(embedMsg)}`;
			return userReply.reply({ content });
		}
	},
};