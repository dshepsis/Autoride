const { SlashCommandBuilder } = require('@discordjs/builders');
const Keyv = require('keyv');
const privilegeLevels = require('../privilegeLevels');


// Load configuration database. This will be used to find which color roles
// the current server has:
const colorRolesDB = new Keyv('sqlite://database.sqlite', { namespace: 'colorRoles' });
colorRolesDB.on('error', err => console.log('Connection Error when searching for colorRolesDB', err));

const ALREADY_PRESENT = Symbol('Color role is already present in this guild.');
async function addColorRole(guildId, role) {
	const guildColorRoles = await colorRolesDB.get(guildId);
	if (guildColorRoles === undefined) {
		return colorRolesDB.set(guildId, { [role.id]: role.name });
	}
	if (role.id in guildColorRoles) {
		return ALREADY_PRESENT;
	}
	guildColorRoles[role.id] = role.name;
	return colorRolesDB.set(guildId, guildColorRoles);
}

const NOT_PRESENT = Symbol('Color role is not present in this guild.');
const NO_ROLES = Symbol('This guild has no color roles.');
async function removeColorRole(guildId, role) {
	const guildColorRoles = await colorRolesDB.get(guildId);
	if (guildColorRoles === undefined) {
		return NO_ROLES;
	}
	if (!(role.id in guildColorRoles)) {
		return NOT_PRESENT;
	}
	delete guildColorRoles[role.id];
	return colorRolesDB.set(guildId, guildColorRoles);
}

async function getColorRolesIds(guildId) {
	const guildColorRoles = await colorRolesDB.get(guildId);
	if (guildColorRoles === undefined) return NO_ROLES;
	return Object.keys(guildColorRoles);
}

module.exports = {
	data: (new SlashCommandBuilder()
		.setName('manage-colors')
		.setDescription('Add, remove, and list color roles.')
		.addSubcommand(subcommand => subcommand
			.setName('add')
			.setDescription('Add a new color role for this server.')
			.addRoleOption(option => option
				.setName('role')
				.setDescription('The role to add to the list of color roles.')
				.setRequired(true)
			)
		)
		.addSubcommand(subcommand => subcommand
			.setName('remove')
			.setDescription('Remove a color role from this server.')
			.addRoleOption(option => option
				.setName('role')
				.setDescription('The role to remove from the list of color roles.')
				.setRequired(true)
			)
		)
		// @TODO implement a way to re-arrange the order of color roles in the keyv store:
		// .addSubcommand(subcommand => subcommand
		// 	.setName('arrange')
		// 	.setDescription('Change the order in which color roles are presented.')
		// )
		.addSubcommand(subcommand => subcommand
			.setName('list')
			.setDescription('List all of the color roles for this server.')
		)
		.setDefaultPermission(false)
	),
	minimumPrivilege: privilegeLevels.byName.MOD,
	async execute(interaction) {
		const subcommandName = interaction.options.getSubcommand();
		let content;
		if (subcommandName === 'add') {
			const role = interaction.options.getRole('role');
			if (role.name === '@everyone') {
				content = 'You cannot use @everyone as a color role!';
			}
			else {
				const result = await addColorRole(interaction.guildId, role);
				if (result === ALREADY_PRESENT) {
					content = `${role} is already a color role in this server.`;
				}
				else if (result) {
					content = `Successfully added ${role} to the list of color roles.`;
				}
				else {
					content = `Failed to add ${role} to the list of color roles.`;
				}
			}
		}
		else if (subcommandName === 'remove') {
			const role = interaction.options.getRole('role');
			const result = await removeColorRole(interaction.guildId, role);
			if (result === NOT_PRESENT) {
				content = `${role} already isn't a color role in this server.`;
			}
			else if (result) {
				content = `Successfully removed ${role} from the list of color roles.`;
			}
			else {
				content = `Failed to remove ${role} from the list of color roles.`;
			}
		}
		else if (subcommandName === 'list') {
			const roleIds = await getColorRolesIds(interaction.guildId);
			if (roleIds === NO_ROLES) {
				content = 'This server has no color roles. Try using `/manage-colors add` to add some!';
			}
			else {
				content = `This server's color roles are:\n${roleIds.map(id => `<@&${id}>`).join('\n')}`;
			}
		}
		return interaction.reply({ content });
	},
};