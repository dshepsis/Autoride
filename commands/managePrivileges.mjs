import { SlashCommandBuilder } from '@discordjs/builders';
import { byOrder, asChoices, MASTER_USER_ONLY } from '../privilegeLevels.mjs';
import { deployPermissions } from '../util/deploy-permissions.mjs';

import * as guildConfig from '../util/guildConfig.mjs';
/** Load privileged roles data from guild-config directory */
async function getPrivilegedRoles(guildId) {
	return await guildConfig.get(
		guildId,
		'privilegedRoles'
	);
}
/** Write privileged roles data to guild-config directory */
async function setPrivilegedRoles(guildId, guildPrivilegeLevels) {
	return await guildConfig.set(guildId, 'privilegedRoles', guildPrivilegeLevels);
}

const ALREADY_ASSOCIATED = Symbol('This role is already associated with this privilege level in this guild.');
async function associateRoleWithPrivilegeLevel({
	guild,
	role,
	privilegeLevelName,
} = {}) {
	const guildId = guild.id;
	const guildPrivilegeLevels = await getPrivilegedRoles(guildId);
	if (guildPrivilegeLevels === undefined) {
		return await setPrivilegedRoles(guildId, { [privilegeLevelName]: role.id });
	}
	if (privilegeLevelName in guildPrivilegeLevels) {
		return ALREADY_ASSOCIATED;
	}
	guildPrivilegeLevels[privilegeLevelName] = role.id;

	// Make sure to wait for the file to be updated before attempting to deploy
	// the updated permissions:
	await setPrivilegedRoles(guildId, guildPrivilegeLevels);

	// Get command id mapping from guild data:
	const commandNameToId = Object.create(null);
	const commands = await guild.commands.fetch();
	for (const command of commands.values()) {
		commandNameToId[command.name] = command.id;
	}

	return await deployPermissions({
		guildId,
		commandNameToId,
	});
}

const NOT_ASSOCIATED = Symbol('This privilege level already has no associated role in this guild.');
const NO_PRIVILEGES = Symbol('This guild has no roles associated with any privilege levels.');
async function removeAssociationsFromPrivilegeLevel({
	guild,
	privilegeLevelName,
} = {}) {
	const guildId = guild.id;
	const guildPrivilegeLevels = await getPrivilegedRoles(guildId);
	if (guildPrivilegeLevels === undefined) {
		return NO_PRIVILEGES;
	}
	if (!(privilegeLevelName in guildPrivilegeLevels)) {
		return NOT_ASSOCIATED;
	}
	delete guildPrivilegeLevels[privilegeLevelName];

	// Make sure to wait for the DB to be updated before attempting to deploy
	// the updated permissions:
	await guildConfig.set(guildId, 'privilegedRoles', guildPrivilegeLevels);
	await setPrivilegedRoles(guildId, guildPrivilegeLevels);

	// Get command id mapping from guild data:
	const commandNameToId = Object.create(null);
	const commands = await guild.commands.fetch();
	for (const command of commands.values()) {
		commandNameToId[command.name] = command.id;
	}

	return await deployPermissions({
		guildId,
		commandNameToId,
	});
}

async function getPrivilegeLevelAssociationsString(guildId) {
	const guildPrivilegeLevels = await getPrivilegedRoles(guildId);
	const tHead = '__**Associated Role - Privilege Level Name - Description**__';
	let tBody;
	if (guildPrivilegeLevels === undefined) {
		tBody = (byOrder
			.map(p => `UNASSOCIATED - ${p.name} - ${p.description}`)
			.join('\n')
		);
	}
	else {
		tBody = (byOrder
			.map(p => {
				const privilegedRoleId = guildPrivilegeLevels[p.name];
				const roleStr = (privilegedRoleId === undefined)
					? 'UNASSOCIATED'
					: `<@&${privilegedRoleId}>`;
				return `${roleStr} - ${p.name} - ${p.description}`;
			})
			.join('\n')
		);
	}
	return `${tHead}\n${tBody}`;
}

async function getRoleIdAssociatedWithPrivilegeLevel({
	guild,
	privilegeLevelName,
} = {}) {
	const guildPrivilegeLevels = await getPrivilegedRoles(guild.id);
	return guildPrivilegeLevels[privilegeLevelName];
}

export const data = (new SlashCommandBuilder()
	.setName('manage-privileges')
	.setDescription('Associate roles in this server with this bot\'s different generic privilege levels.')
	.addSubcommand(subcommand => subcommand
		.setName('associate')
		.setDescription('Associates the given role with the given privilege level.')
		.addRoleOption(option => option
			.setName('role')
			.setDescription('The role to associate with the given privilege level.')
			.setRequired(true)
		)
		.addStringOption(option => option
			.setName('privilege-level')
			.setDescription('The privilege level to associate the given role with.')
			.setRequired(true)
			.setChoices(asChoices)
		)
	)
	.addSubcommand(subcommand => subcommand
		.setName('remove')
		.setDescription('Removes the role associated with the given privilege level.')
		.addStringOption(option => option
			.setName('privilege-level')
			.setDescription('The privilege level from which to remove its associated role.')
			.setRequired(true)
			.setChoices(asChoices)
		)
	)
	.addSubcommand(subcommand => subcommand
		.setName('list')
		.setDescription('List the associations between privilege levels and roles for this guild.')
	)
	.setDefaultPermission(false)
);
export const minimumPrivilege = MASTER_USER_ONLY;
export async function execute(interaction) {
	const guild = interaction.guild;
	const subcommandName = interaction.options.getSubcommand();
	let content;
	if (subcommandName === 'associate') {
		const role = interaction.options.getRole('role');
		if (role.name === '@everyone') {
			content = 'You cannot associated the @everyone role with a privilege!';
			return await interaction.reply({ content });
		}
		const privilegeLevelName = interaction.options.getString('privilege-level');
		const result = await associateRoleWithPrivilegeLevel({
			guild,
			role,
			privilegeLevelName,
		});
		if (result === ALREADY_ASSOCIATED) {
			content = `${role} is already associated with the privilege level ${privilegeLevelName}.`;
		}
		else if (result) {
			content = `Successfully associated ${role} with the privilege level ${privilegeLevelName}.`;
		}
		else {
			content = `Failed to associated ${role} with the privilege level ${privilegeLevelName}.`;
		}
	}
	else if (subcommandName === 'remove') {
		const privilegeLevelName = interaction.options.getString('privilege-level');
		const roleId = await getRoleIdAssociatedWithPrivilegeLevel({
			guild,
			privilegeLevelName,
		});
		const role = `<@&${roleId}>`;
		const result = await removeAssociationsFromPrivilegeLevel({
			guild,
			privilegeLevelName,
		});
		if (result === NOT_ASSOCIATED) {
			content = `The privilege level ${privilegeLevelName} already had no associated role.`;
		}
		else if (result) {
			content = `Successfully removed ${role} from the privilege level ${privilegeLevelName}.`;
		}
		else {
			content = `Failed to remove ${role} from the privilege level ${privilegeLevelName}.`;
		}
	}
	else if (subcommandName === 'list') {
		const guildId = guild.id;
		content = await getPrivilegeLevelAssociationsString(guildId);
	}
	return await interaction.reply({ content });
}