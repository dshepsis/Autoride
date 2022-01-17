const { SlashCommandBuilder } = require('@discordjs/builders');

const MAX_MESSAGES = 100;

module.exports = {
	data: new SlashCommandBuilder()
		.setName('prune')
		.setDescription(`Bulk delete up to ${MAX_MESSAGES} messages.`)
		.addIntegerOption(option => option
			.setName('amount')
			.setDescription(`Number of messages to delete, between 1 and ${MAX_MESSAGES}.`)
			.setRequired(true)
			.setMinValue(1)
			.setMaxValue(MAX_MESSAGES)
		),
	async execute(interaction) {
		const amount = interaction.options.getInteger('amount');

		if (amount < 1 || amount > MAX_MESSAGES) {
			const content = `You must choose a number between 1 and ${MAX_MESSAGES} (inclusive).`;
			return interaction.reply({ content, ephemeral: true });
		}

		try {
			const messages = await interaction.channel.bulkDelete(amount, true);
			const content = `Successfully deleted \`${messages.size}\` messages.`;
			return interaction.reply({ content, ephemeral: true });
		}
		catch (error) {
			console.error(error);
			const content = 'There was an error trying to delete messages in this channel!';
			return interaction.reply({ content, ephemeral: true });
		}
	},
};