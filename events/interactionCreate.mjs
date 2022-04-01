export const name = 'interactionCreate';
export async function execute(interaction) {
	console.log(`${interaction.user.tag} in guild "${interaction.guild.name}" #${interaction.channel.name} triggered an interaction.`);

	// Handle regular slash commands:
	if (interaction.isCommand()) {
		const command = interaction.client.commands.get(interaction.commandName);

		if (!command) {
			return;
		}

		try {
			return await command.execute(interaction);
		}
		catch (error) {
			console.error(`The "${interaction.commandName}" command failed at ${Date()} with the following error:`, error);
			const content = `There was an error while executing this "${interaction.commandName}" command!`;
			try {
				return await interaction.reply({ content });
			}
			catch (reportErrorToUserError) {
				console.error(`Sending an error reply for the "${interaction.commandName}" command also failed at ${Date()}...`, reportErrorToUserError);
			}
		}
	}
}