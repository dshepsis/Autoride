const { MessageActionRow, MessageSelectMenu } = require('discord.js');
const { SlashCommandBuilder } = require('@discordjs/builders');

function createRoleSelector({ name, description, roles } = {}) {
	const selectOptions = Object.entries(roles).map(([k, v]) => ({
		label: k,
		value: v,
	}));

	// Execute function for slash command:
	async function execute(interaction) {
		// Configure the selection box with role options:
		const row = new MessageActionRow()
			.addComponents(
				new MessageSelectMenu()
					.setCustomId(name)
					.setPlaceholder('Select a role...')
					.addOptions(selectOptions),
			);

		// Send the initial reply to the command:
		{
			const content = `Choose one of these roles:\n${Object.values(roles).map(id => `<@&${id}>`).join('\n')}`;
			await interaction.reply({ content, components: [row], ephemeral: true });
		}

		// Retrieve the reply (with the select box) so that we can attach a
		// collector to listen for selections:
		const selectMessage = await interaction.fetchReply();

		// Create the collector:
		const filter = (selectInteraction) => selectInteraction.customId === name && selectInteraction.user.id === interaction.user.id;
		const IDLE_TIMEOUT = 30000; // milliseconds
		const collector = selectMessage.createMessageComponentCollector(
			{ filter, componentType: 'SELECT_MENU', idle: IDLE_TIMEOUT }
		);

		// Each time the user makes a selection, assign them the selected role and
		// remove the other roles they didn't select:
		collector.on('collect', selectInteraction => {
			const roleIdToAdd = selectInteraction.values[0];

			const userRoles = selectInteraction.member.roles;
			userRoles.add(roleIdToAdd);
			for (const roleIdToRemove of Object.values(roles)) {
				if (roleIdToRemove === roleIdToAdd) {
					continue;
				}
				userRoles.remove(roleIdToRemove);
			}

			const content = `You're now <@&${roleIdToAdd}>! You can still choose:\n${Object.values(roles).map(id => `<@&${id}>`).join('\n')}`;
			return selectInteraction.update({ content, ephemeral: true });
		});

		// If the collector times-out, edit the original reply to remove the select box and give an explanation:
		collector.on('end', () => {
			const content = `You waited too long (>${Math.floor(IDLE_TIMEOUT / 1000)} seconds) to select a role!`;
			interaction.editReply({ content, components: [] });
		});
	}

	return {
		data: new SlashCommandBuilder()
			.setName(name)
			.setDescription(description),
		execute,
	};
}

module.exports = { createRoleSelector };