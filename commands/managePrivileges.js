const Keyv = require('keyv');
const { SlashCommandBuilder } = require('@discordjs/builders');
const privilegeLevels = require('../privilegeLevels');

// Load configuration database. This will be used to find which color roles
// the current server has:
const privilegedRolesDB = new Keyv('sqlite://database.sqlite', { namespace: 'privilegedRoles' });
privilegedRolesDB.on('error', err => console.log('Connection Error when searching for privilegedRolesDB', err));

const ALREADY_ASSOCIATED = Symbol('This role is already associated with this privilege level in this guild.');
async function associateRoleWithPrivilegeLevel(guildId, role, privilegeLevelName) {
	const guildPrivilegeLevels = await privilegedRolesDB.get(guildId);
	if (guildPrivilegeLevels === undefined) {
		return privilegedRolesDB.set(guildId, { [privilegeLevelName]: role.id });
	}
	if (privilegeLevelName in guildPrivilegeLevels) {
		return ALREADY_ASSOCIATED;
	}
	guildPrivilegeLevels[privilegeLevelName] = role.id;
	return privilegedRolesDB.set(guildId, guildPrivilegeLevels);
} // @TODO: FINISH Copying analogous functions from manageColors.js

const NOT_ASSOCIATED = Symbol('This role is not associated with this privilege level in this guild.');
const NO_PRIVILEGES = Symbol('This guild has no roles associated with any privilege levels.');
async function removeRoleFromPrivilegeLevel(guildId, role, privilegeLevelName) {
	const guildPrivilegeLevels = await privilegedRolesDB.get(guildId);
	if (guildPrivilegeLevels === undefined) {
		return NO_PRIVILEGES;
	}
	if (!(privilegeLevelName in guildPrivilegeLevels)) {
		return NOT_ASSOCIATED;
	}
	delete guildPrivilegeLevels[privilegeLevelName];
	return privilegedRolesDB.set(guildId, guildPrivilegeLevels);
}

async function getPrivilegeLevelAssociationsString(guildId) {
	const guildPrivilegeLevels = await privilegedRolesDB.get(guildId);
	if (guildPrivilegeLevels === undefined) {
		return privilegeLevels.byOrder.map(p => `UNASSOCIATED - ${p.name} - ${p.description}`).join('\n');
	}
	return privilegeLevels.byOrder.map(p => {
		const privilegedRoleId = guildPrivilegeLevels[p.name];
		const roleStr = (privilegedRoleId === undefined)
			? 'UNASSOCIATED'
			: `<@&${privilegedRoleId}>`;
		return `${roleStr} - ${p.name} - ${p.description}`;
	}).join('\n');
}

module.exports = {
	data: (new SlashCommandBuilder()
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
				.setChoices(privilegeLevels.asChoices)
			)
		)
		.addSubcommand(subcommand => subcommand
			.setName('remove')
			.setDescription('Removes the association between the given role and privilege level.')
			.addRoleOption(option => option
				.setName('role')
				.setDescription('The role to associate with the given privilege level.')
				.setRequired(true)
			)
			.addStringOption(option => option
				.setName('privilege-level')
				.setDescription('The privilege level to associate the given role with.')
				.setRequired(true)
				.setChoices(privilegeLevels.asChoices)
			)
		)
		.addSubcommand(subcommand => subcommand
			.setName('list')
			.setDescription('List the associations between privilege levels and roles for this guild.')
		)
		.setDefaultPermission(false)
	),
	async execute(interaction) {
		const guildId = interaction.guildId;
		const subcommandName = interaction.options.getSubcommand();
		let content;
		if (subcommandName === 'associate') {
			const role = interaction.options.getRole('role');
			const privilegeLevelName = interaction.options.getString('privilege-level');
			const result = await associateRoleWithPrivilegeLevel(guildId, role, privilegeLevelName);
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
			const role = interaction.options.getRole('role');
			const privilegeLevelName = interaction.options.getString('privilege-level');
			const result = await removeRoleFromPrivilegeLevel(guildId, role, privilegeLevelName);
			if (result === NOT_ASSOCIATED) {
				content = `${role} already isn't associated with the privilege level ${privilegeLevelName}.`;
			}
			else if (result) {
				content = `Successfully removed ${role} from the privilege level ${privilegeLevelName}.`;
			}
			else {
				content = `Failed to remove ${role} from the privilege level ${privilegeLevelName}.`;
			}
		}
		else if (subcommandName === 'list') {
			content = await getPrivilegeLevelAssociationsString(guildId);
		}
		return interaction.reply({ content });
	},
};