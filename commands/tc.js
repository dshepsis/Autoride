const { SlashCommandBuilder } = require('@discordjs/builders');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('tc')
		.setDescription('Test the option choices functionality.')
		.addIntegerOption(option => option
			.setName('int')
			.setDescription('Choose one of these integers.')
			.setRequired(true)
			.setChoices([
				['1', 1111],
				['2', 222],
				['3', 44],
			])
		),
	async execute(interaction) {
		const int = interaction.options.getInteger('int');

		const content = `You said: "${int}".`;
		return interaction.reply({ content, ephemeral: true });
	},
};