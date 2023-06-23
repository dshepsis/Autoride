import { SlashCommandBuilder } from 'discord.js';
import * as guildConfig from '../util/guildConfig.mjs';
import { splitReplyInteraction } from '../util/splitMessageRegex.mjs';

const ALREADY_PRESENT = Symbol('Color role is already present in this guild.');
async function addColorRole(guildId, role, message) {
	const guildColorRoles = await guildConfig.get(guildId, 'colorRoles');
	const roleData = {
		name: role.name,
		message,
	};
	if (guildColorRoles === undefined) {
		return await guildConfig.set(guildId, 'colorRoles', { [role.id]: roleData });
	}
	// If the role to be added doesn't have a message, and there is already an
	// entry for this role in this guild, just return a symbol indicating that
	// no changes were made
	if (!message && (role.id in guildColorRoles)) {
		return ALREADY_PRESENT;
	}
	// If this role isn't already tagged as a color role, or if a new message was
	// included, add an entry, or update the existing one respectively.
	guildColorRoles[role.id] = roleData;
	return await guildConfig.set(guildId, 'colorRoles', guildColorRoles);
}

const NOT_PRESENT = Symbol('Color role is not present in this guild.');
const NO_ROLES = Symbol('This guild has no color roles.');
async function removeColorRole(guildId, role) {
	const guildColorRoles = await guildConfig.get(guildId, 'colorRoles');
	if (guildColorRoles === undefined) {
		return NO_ROLES;
	}
	if (!(role.id in guildColorRoles)) {
		return NOT_PRESENT;
	}
	delete guildColorRoles[role.id];
	return await guildConfig.set(guildId, 'colorRoles', guildColorRoles);
}

async function getColorRolesStr(interaction) {
	const guild = interaction.guild;
	const guildColorRoles = await guildConfig.get(guild.id, 'colorRoles');
	if (guildColorRoles === undefined) return NO_ROLES;
	const roleIds = Object.keys(guildColorRoles);

	function idToMessageStr(id) {
		const message = guildColorRoles[id].message;
		if (message) {
			return `"${message}"`;
		}
		return 'No message.';
	}
	return (roleIds
		.sort((r1, r2) => guild.roles.comparePositions(r2, r1))
		.map(id => `<@&${id}> - ${idToMessageStr(id)}`)
		.join('\n')
	);
}

export const data = (new SlashCommandBuilder()
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
		.addStringOption(option => option
			.setName('message')
			.setDescription('The message to give the user after the role is assigned.')
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
	.addSubcommand(subcommand => subcommand
		.setName('list')
		.setDescription('List all of the color roles for this server.')
	)
	.setDefaultMemberPermissions(0)
);
export async function execute(interaction) {
	const subcommandName = interaction.options.getSubcommand();
	let content;
	if (subcommandName === 'add') {
		const role = interaction.options.getRole('role');
		const message = interaction.options.getString('message');
		if (role.name === '@everyone') {
			content = 'You cannot use @everyone as a color role!';
		}
		else {
			const result = await addColorRole(interaction.guildId, role, message);
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
		return await interaction.reply({ content });
	}
	if (subcommandName === 'remove') {
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
		return await interaction.reply({ content });
	}
	if (subcommandName === 'list') {
		const roleStr = await getColorRolesStr(interaction);
		if (roleStr === NO_ROLES) {
			content = 'This server has no color roles. Try using `/manage-colors add` to add some!';
			return await interaction.reply({ content });
		}
		const header = '__**Role - Message**__\n';
		return await splitReplyInteraction(
			interaction,
			`This server's color roles are:\n${header}${roleStr}`,
			{ prepend: `More color roles:\n${header}` });
	}
}