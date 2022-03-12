export const name = 'interactionCreate';
export async function execute(interaction) {
	console.log(`${interaction.user.tag} in #${interaction.channel.name} triggered an interaction.`);

	// Handle regular slash commands:
	if (interaction.isCommand()) {
		const command = interaction.client.commands.get(interaction.commandName);

		if (!command) {
			return;
		}

		try {
			return command.execute(interaction);
		}
		catch (error) {
			console.error(error);
			const content = 'There was an error while executing this command!';
			return interaction.reply({ content, ephemeral: true });
		}
	}
}