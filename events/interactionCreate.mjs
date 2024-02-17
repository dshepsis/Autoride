export const name = 'interactionCreate';
export async function execute(interaction) {
	console.log(`${interaction.user.tag} in guild "${interaction.guild.name}" #${interaction.channel.name} triggered a ${interaction.type} interaction.`);

	// Handle regular slash commands:
	if (interaction.isCommand()) {
		const command = interaction.client.commands.get(interaction.commandName);
		console.log(`Executing ${interaction.commandName} command.`);

		if (!command) {
			console.error(`No such command "${interaction.commandName}" found}.`);
			return;
		}

		try {
			const commandResult = await command.execute(interaction);
			console.log(`Succesfully executed ${interaction.commandName} command.`);
			return commandResult;
		}
		catch (error) {
			console.error(`The "${interaction.commandName}" command failed with the following error:`, error);

			// Send a message to the development guild that there was an error
			// with a command, so that the bot owner can know and investigate.
			interaction.client.reportError(`User ${interaction.user.tag} in guild "${interaction.guild.name}" #${interaction.channel.name} executed the "${interaction.commandName}" command, which failed with an ${error.name} error: "${error.message}"`);

			const content = `There was an error while executing this "${interaction.commandName}" command!`;
			try {
				// If the interaction was already replied-to or deferred before
				// the error, use the appropriate alternative reply function
				// instead. Otherwise, .reply will throw an
				// "INTERACTION_ALREADY_REPLIED" error.
				if (interaction.replied) {
					return await interaction.followUp({ content });
				}
				if (interaction.deferred) {
					return await interaction.editReply({ content });
				}
				return await interaction.reply({ content });
			}
			catch (reportErrorToUserError) {
				console.log(`ERROR: Sending an error reply for the "${interaction.commandName}" command also failed. Restarting...`, reportErrorToUserError);
				process.kill(process.pid, 'SIGTERM');
			}
		}
	}
}