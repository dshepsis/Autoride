import { MessageActionRow, MessageSelectMenu } from 'discord.js';
import { SlashCommandBuilder } from '@discordjs/builders';

async function getSelectableRoles({
	roles,
	rolesFromInteraction,
	interaction,
} = {}) {
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

// The maximum number of options on a select menu permitted by Discord's API
// See: https://discord.com/developers/docs/interactions/message-components#select-menu-object-select-menu-structure
export const MAX_PAGE_SIZE = 25;

export function createRoleSelector({
	// The name of the command and selector component
	name,
	// Command description
	description,
	// Optional - An object mapping selectable role ID's to objects with a name
	// property (used in the options list) and an optional message property
	// (included in the message sent when a role is successfully selected). If
	// omitted, rolesFromInteraction must be provided instead.
	roles,
	// Optional - A function taking an interaction object and returning a roles
	// object (see above). If omitted, roles must be provided instead.
	rolesFromInteraction,
	// Optional - True if the returned command should be usable by all users by
	// default. False if it should be disabled for all users by default.
	defaultPermission = true,
	// Optional - What privilege-level the returned command should have if
	// defaultPermission is false. See privilegeLevels.
	minimumPrivilege,
	// Optional - If true, the roles will be sorted based on the order they're
	// listed in the server's role settings. If false, they will be in the order
	// given by the roles/rolesFromInteraction parameter.
	sortByGuildOrder = false,
	// Optional - How many roles should be listed on each selection page. If there
	// are fewer roles than this value, pagination will not be used. Must be an
	// integer between 1 and MAX_PAGE_SIZE. Ensure that the number of roles
	// divided by the page size is also less than MAX_PAGE_SIZE.
	pageSize = MAX_PAGE_SIZE,
} = {}) {
	if (pageSize < 1) {
		throw new RangeError(`For createRoleSelector, pageSize must be greater than 1 and less than ${MAX_PAGE_SIZE}. Instead got ${pageSize}.`);
	}
	if (!Number.isInteger(pageSize)) {
		throw new RangeError(`For createRoleSelector, pageSize must be an integer. Instead got ${pageSize}.`);
	}

	// This function is called when a user uses a slash command:
	async function execute(interaction) {
		const selectableRoles = await getSelectableRoles({
			roles,
			rolesFromInteraction,
			interaction,
		});

		const allRoleIds = Object.keys(selectableRoles);

		const numRoles = allRoleIds.length;
		if (numRoles === 0) {
			const content = `No roles were provided for the ${name} command!`;
			return interaction.reply({ content, ephemeral: true });
		}
		const numPages = Math.ceil(numRoles / pageSize);
		if (numPages > MAX_PAGE_SIZE) {
			throw new RangeError(`Because page size was set to ${pageSize} and the number of roles is ${numRoles}, the number of pages should be ${numPages}, but no more than ${MAX_PAGE_SIZE} pages are allowed. To fix this, either increase ${pageSize} or decrease the number of selectable roles!`);
		}

		if (sortByGuildOrder) {
			allRoleIds.sort((r1, r2) => interaction.guild.roles.comparePositions(r2, r1));
		}

		// The roles have to be formatted in a particular way for the Select Menu
		// component:
		const allSelectOptions = allRoleIds.map(id => ({
			label: selectableRoles[id].name,
			value: id,
		}));

		let currentPage = 0;
		function getCurrentRoleSelectRow() {
			const firstIndex = currentPage * pageSize;
			const options = allSelectOptions.slice(
				firstIndex,
				firstIndex + pageSize
			);
			return new MessageActionRow().addComponents(new MessageSelectMenu()
				.setCustomId(name)
				.setPlaceholder('Select a role...')
				.addOptions(options)
			);
		}

		// Returns a \n-separated list of Discord role mentions. When sent as a
		// message in Discord, the ID's will be resolved to the role names. E.g. the
		// line with a role id for a role named "red" will be rendered as "@red"
		// in that role's color. This is useful for previewing role colors before
		// making a selection.
		function getCurrentRolesStr() {
			const firstIndex = currentPage * pageSize;
			return (allRoleIds
				.slice(firstIndex, firstIndex + pageSize)
				.map(id => `<@&${id}>`)
				.join('\n')
			);
		}

		function getPageSelectRow() {
			const pageOptions = [];
			for (let i = 1; i <= numPages; ++i) {
				const iStr = i.toString();
				pageOptions.push({ label: iStr, value: iStr });
			}
			return new MessageActionRow().addComponents(new MessageSelectMenu()
				.setCustomId('page')
				.setPlaceholder(`Go to a page. Currently on page ${currentPage + 1}/${numPages}`)
				.addOptions(pageOptions)
			);
		}

		function getCurrentComponents() {
			const rows = [getCurrentRoleSelectRow()];
			if (numPages > 1) rows.push(getPageSelectRow());
			return rows;
		}

		// Send the initial reply to the command:
		{
			const content = `Choose one of these roles:\n${getCurrentRolesStr()}`;
			await interaction.reply({
				content,
				components: getCurrentComponents(),
				ephemeral: true,
			});
		}

		// Retrieve the reply (with the select box) so that we can attach a
		// collector to listen for selections:
		const selectMessage = await interaction.fetchReply();

		// Create the collector:
		const filter = selectInteraction => (
			selectInteraction.user.id === interaction.user.id
		);
		const IDLE_TIMEOUT = 30000; // milliseconds
		const collector = selectMessage.createMessageComponentCollector(
			{ filter, componentType: 'SELECT_MENU', idle: IDLE_TIMEOUT }
		);

		// Each time the user makes a selection, assign them the selected role and
		// remove the other roles they didn't select:
		collector.on('collect', async (selectInteraction) => {
			// Handle changing role pages:
			if (selectInteraction.customId === 'page') {
				currentPage = Number(selectInteraction.values[0]) - 1;
				const content = `Choose one of these roles:\n${getCurrentRolesStr()}`;
				return await selectInteraction.update({
					content,
					components: getCurrentComponents(),
				});
			}

			// Otherwise, handle role selection:
			const roleIdToAdd = selectInteraction.values[0];

			const userRolesManager = selectInteraction.member.roles;
			const userRoles = userRolesManager.cache;
			let content;
			if (userRoles.has(roleIdToAdd)) {
				content = `You already have the <@&${roleIdToAdd}> role!`;
			}
			else {
				// Get all of a users current roles, then remove any existing roles in
				// this selector, and add in the selected role. Then, use the
				// GuildMemberRoleManager.set method to change the user's roles in a
				// single Discord API request:
				const setOfRoleIdsToSet = new Set(userRoles.keys());
				for (const roleId in selectableRoles) {
					if (roleIdToAdd === roleId) continue;
					setOfRoleIdsToSet.delete(roleId);
				}
				setOfRoleIdsToSet.add(roleIdToAdd);
				await userRolesManager.set(Array.from(setOfRoleIdsToSet));
				const customMessage = selectableRoles[roleIdToAdd].message;
				content = customMessage ?? `You're now <@&${roleIdToAdd}>!`;
			}
			content += ` You can still choose:\n${getCurrentRolesStr()}`;
			return selectInteraction.update({ content, ephemeral: true });
		});

		// If the collector times-out, edit the original reply to remove the select
		// box and give an explanation:
		collector.on('end', () => {
			const content = `This role-selection command timed out after ${
				Math.floor(IDLE_TIMEOUT / 1000)
			} seconds. Please dismiss this message and use the command again if needed.`;
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