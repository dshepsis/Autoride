const { MessageActionRow, MessageButton } = require('discord.js');
const { SlashCommandBuilder } = require('@discordjs/builders');
const privilegeLevels = require('../privilegeLevels');

const MAX_MESSAGES = 100;

module.exports = {
	data: (new SlashCommandBuilder()
		.setName('prune')
		.setDescription(`Bulk delete up to ${MAX_MESSAGES} messages.`)
		.addIntegerOption(option => option
			.setName('amount')
			.setDescription(`Number of messages to delete, between 1 and ${MAX_MESSAGES}.`)
			.setRequired(true)
			.setMinValue(1)
			.setMaxValue(MAX_MESSAGES)
		)
		.setDefaultPermission(false)
	),
	minimumPrivilege: privilegeLevels.byName.ADMIN,
	async execute(interaction) {
		const amount = interaction.options.getInteger('amount');

		if (amount < 1 || amount > MAX_MESSAGES) {
			const content = `You must choose a number between 1 and ${MAX_MESSAGES} (inclusive).`;
			return interaction.reply({ content, ephemeral: true });
		}

		// Warn the user against deleting a lot of messages by accident:
		const CUSTOM_ID = 'prune';
		const row = new MessageActionRow().addComponents(new MessageButton()
			.setCustomId(CUSTOM_ID)
			.setLabel(`Yes, delete ${amount} messages.`)
			.setStyle('DANGER'),
		);
		{
			const content = `WARNING: You're about to delete the last ${amount} messages. This CANNOT be undone!`;
			await interaction.reply({ content, components: [row], ephemeral: true });
		}
		const warningMessage = await interaction.fetchReply();

		// Create the collector:
		const filter = (warningInteraction) => warningInteraction.customId === CUSTOM_ID && warningInteraction.user.id === interaction.user.id;
		const IDLE_TIMEOUT = 30000; // milliseconds
		let buttonInteraction;
		try {
			buttonInteraction = await warningMessage.awaitMessageComponent(
				{ filter, componentType: 'BUTTON', time: IDLE_TIMEOUT }
			);
		}
		catch (error) {
			const content = `This \`/prune\` command timed out after ${Math.floor(IDLE_TIMEOUT / 1000)} seconds. Please dismiss this message and use the command again if needed.`;
			return interaction.editReply({ content, components: [], ephemeral: true });
		}
		if (buttonInteraction.customId !== CUSTOM_ID) {
			const content = 'You clicked an unexpected button!';
			buttonInteraction.update({ content, components: [], ephemeral: true });
		}

		try {
			const messages = await interaction.channel.bulkDelete(amount, true);
			const content = `Successfully deleted \`${messages.size}\` messages.`;
			return buttonInteraction.update({ content, components: [], ephemeral: true });
		}
		catch (error) {
			console.error(error);
			const content = 'There was an error trying to delete messages in this channel!';
			return buttonInteraction.update({ content, components: [], ephemeral: true });
		}
	},
};