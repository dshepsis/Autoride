const { MessageActionRow, MessageSelectMenu } = require('discord.js');
const { SlashCommandBuilder } = require('@discordjs/builders');

async function getSelectableRoles({ roles, rolesFromInteraction, interaction } = {}) {
	if (roles === undefined) {
		if (rolesFromInteraction === undefined) {
			throw new Error('Must define either a roles object or a rolesFromInteraction function!');
		}
		else {
			return rolesFromInteraction(interaction);
		}
	}
	else if (rolesFromInteraction !== undefined) {
		throw new Error('Can\'t define both a roles object and a rolesFromInteraction function!');
	}
	return roles;
}

function createRoleSelector({
	name, // The name of the command and selector component
	description, // Command description
	roles, // optional. An object mapping selectable role ID's to role names. If omitted, rolesFromInteraction must be provided instead.
	rolesFromInteraction, // optional. A function taking an interaction object and returning a roles object (see above). If omitted, roles must be provided instead.
	defaultPermission = true, // True if the returned command should be usable by all users by default. False if it should be disabled for all users by default.
	minimumPrivilege, // optional. What privilege-level the returned command should have if defaultPermission is false. See privilegeLevels.js.
} = {}) {
	// This function is called when a user uses a slash command:
	async function execute(interaction) {
		const selectableRoles = await getSelectableRoles({ roles, rolesFromInteraction, interaction });

		// The roles have to be formatted in a particular way for the Select Menu
		// component:
		const selectOptions = Object.entries(selectableRoles).map(([k, v]) => ({
			label: v,
			value: k,
		}));

		// Configure the selection box with role options:
		const row = new MessageActionRow().addComponents(
			new MessageSelectMenu()
				.setCustomId(name)
				.setPlaceholder('Select a role...')
				.addOptions(selectOptions),
		);

		// Send the initial reply to the command:
		{
			const content = `Choose one of these roles:\n${Object.keys(selectableRoles).map(id => `<@&${id}>`).join('\n')}`;
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
		collector.on('collect', async (selectInteraction) => {
			const roleIdToAdd = selectInteraction.values[0];

			const userRoles = selectInteraction.member.roles;
			let content;
			if (userRoles.cache.has(roleIdToAdd)) {
				content = `You already have the <@&${roleIdToAdd}> role!`;
			}
			else {
				const rolesToRemove = [];
				for (const roleId in selectableRoles) {
					if (roleIdToAdd === roleId) continue;
					rolesToRemove.push(roleId);
				}
				await userRoles.remove(rolesToRemove);
				await userRoles.add(roleIdToAdd);
				content = `You're now <@&${roleIdToAdd}>!`;
			}
			content += ` You can still choose:\n${Object.keys(selectableRoles).map(id => `<@&${id}>`).join('\n')}`;
			return selectInteraction.update({ content, ephemeral: true });
		});

		// If the collector times-out, edit the original reply to remove the select box and give an explanation:
		collector.on('end', () => {
			const content = `This role-selection command timed out after ${Math.floor(IDLE_TIMEOUT / 1000)} seconds. Please dismiss this message and use the command again if needed.`;
			interaction.editReply({ content, components: [] });
		});
	}

	return {
		data: (new SlashCommandBuilder()
			.setName(name)
			.setDescription(description)
			.setDefaultPermission(defaultPermission)
		),
		minimumPrivilege,
		execute,
	};
}

module.exports = { createRoleSelector };