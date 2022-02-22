const { SlashCommandBuilder } = require('@discordjs/builders');

const privilegeLevels = require('../privilegeLevels');
const commandConfirmation = require('./command-util/awaitCommandConfirmation');

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

		// Prevent the user from selecting an incorrect number of commands
		if (amount < 1 || amount > MAX_MESSAGES) {
			const content = `You must choose a number of messages to delete between 1 and ${MAX_MESSAGES} (inclusive).`;
			return interaction.reply({ content, ephemeral: true });
		}

		const {
			responseType,
			buttonInteraction,
		} = await commandConfirmation.awaitCommandConfirmation({
			interaction,
			commandName: 'prune',
			warningContent: `WARNING: You're about to delete the last ${amount} messages. This CANNOT be undone!`,
			confirmContent: null,
			confirmButtonLabel: `Yes, delete ${amount} messages.`,
		});
		if (responseType !== commandConfirmation.USER_CONFIRM) {
			// If the user pressed the cancel button or let the confirmation dialog
			// time out, just leave in-place the default replies of
			// awaitCommandConfirmation.
			return buttonInteraction;
		}

		// If the user confirmed they want to bulk delete messages:
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