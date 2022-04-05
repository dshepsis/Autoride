export const name = 'interactionCreate';
export async function execute(interaction) {
	console.log(`${interaction.user.tag} in guild "${interaction.guild.name}" #${interaction.channel.name} triggered a ${interaction.type} interaction at ${Date()}.`);

	// Handle regular slash commands:
	if (interaction.isCommand()) {
		const command = interaction.client.commands.get(interaction.commandName);
		console.log(`Executing ${interaction.commandName} command at ${Date()}.`);

		if (!command) {
			console.error(`No such command "${interaction.commandName}" found at ${Date()}.`);
			return;
		}

		try {
			const commandResult = await command.execute(interaction);
			console.log(`Succesfully executed ${interaction.commandName} command at ${Date()}`);
			return commandResult;
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