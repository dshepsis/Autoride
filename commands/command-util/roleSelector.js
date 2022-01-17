const { MessageActionRow, MessageSelectMenu } = require('discord.js');
const { SlashCommandBuilder } = require('@discordjs/builders');

function createRoleSelector({ name, description, roles } = {}) {
	const selectOptions = Object.entries(roles).map(([k, v]) => ({
		label: k,
		value: v,
	}));
	return {
		data: new SlashCommandBuilder()
			.setName(name)
			.setDescription(description),
		async execute(interaction) {
			const row = new MessageActionRow()
				.addComponents(
					new MessageSelectMenu()
						.setCustomId(name)
						.setPlaceholder('Select a role...')
						.addOptions(selectOptions),
				);
			await interaction.reply({ content: 'Choose one:', components: [row], ephemeral: true });
			const selectMessage = await interaction.fetchReply();

			const filter = (selectInteraction) => selectInteraction.customId === name && selectInteraction.user.id === interaction.user.id;
			const TIME_MILISECONDS = 60000;
			try {
				const selectInteraction = await selectMessage.awaitMessageComponent(
					{ filter, componentType: 'SELECT_MENU', time: TIME_MILISECONDS }
				);
				const roleIdToAdd = selectInteraction.values[0];

				const userRoles = selectInteraction.member.roles;
				for (const roleIdToRemove of Object.values(roles)) {
					userRoles.remove(roleIdToRemove);
				}
				userRoles.add(roleIdToAdd);

				const content = `You selected <@&${roleIdToAdd}>!`;
				interaction.editReply({ content, components: [] });
			}
			catch (error) {
				const content = `You waited too long (>${Math.floor(TIME_MILISECONDS / 1000)} seconds) to select a role!`;
				interaction.editReply({ content, components: [] });
				console.log(`No interactions were collected: ${error}`);
			}
		},
	};
}

module.exports = { createRoleSelector };