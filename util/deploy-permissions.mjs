// COMMAND PERMISSION OVERWRITES:
// In the SlashCommandBuilder (.data property) for a command,
// setDefaultPermission(false) can be used to make a command unusable
// and visually grayed-out for all users. In order to make the command
// usable for specific users, we can then use command permission overwrites
// to whitelist specific users and roles based on id. For this bot,
// permissions are managed through a generic privilege system.
//
// privilegeLevels.mjs defines a series of generic privilege-levels.
// These can be referenced in the .minimumPrivilege property in command module
// files. Then, in each server the bot operates in, the manage-privileges
// command is used to assign each privilege level a role. For example,
// the "MOD" priority level is assigned to the "borks" role in the
// Okami speedrunning discord. These assignments are stored in the corresponding
// guild-config directory in privilegedRoles.json
import { REST } from '@discordjs/rest';
import { Routes } from 'discord-api-types/v9';

import { pkgRelPath } from './pkgRelPath.mjs';
import { importDir } from './importDir.mjs';

import { importJSON } from './importJSON.mjs';
const { clientId, token, masterUserId } = await importJSON(pkgRelPath('./config.json'));

import * as privilegeLevels from '../privilegeLevels.mjs';
import * as guildConfig from '../util/guildConfig.mjs';
/** Load privileged roles data from guild-config directory */
async function getPrivilegedRoles(guildId) {
	return guildConfig.get(
		guildId,
		'privilegedRoles'
	);
}

export async function deployPermissions({
	// The id of the guild to which to apply the command permission overwrites:
	guildId,
	// An object with all the command names as keys, and their corresponding
	// ids (snowflakes) as values:
	commandNameToId,
	// Allow recycling an existing REST connection (e.g. if called from
	// deploy-commands):
	rest = new REST({ version: '9' }).setToken(token),
} = {}) {
	// Import each command module and get the mininumPrivileges
	const commandNameToMinPrivs = Object.create(null);
	const commands = await importDir(pkgRelPath('./commands/'));
	for (const command of commands) {
		if (command.minimumPrivilege === undefined) {
			continue;
		}
		commandNameToMinPrivs[command.data.name] = command.minimumPrivilege;
	}
	// If there are no commands which have setDefaultPermission(false), don't
	// bother registering command permission overwrites:
	if (Object.keys(commandNameToMinPrivs).length === 0) {
		return;
	}

	// This array stores the permission overwrites for every command.
	// It will be used to bulk-update all command permissions for this guild
	// simultaneously:
	const fullPermissions = [];

	// May be undefined if privileged roles haven't been configured for this guild
	// yet:
	const privilegedRolesForThisGuild = await getPrivilegedRoles(guildId);

	for (const commandName in commandNameToMinPrivs) {
		const currentCommandMinPriv = commandNameToMinPrivs[commandName];
		const currentCommandPerms = [];

		// Push the permissions object for this command pre-emptively, then fill
		// in the permissions array afterwards via reference:
		fullPermissions.push({
			id: commandNameToId[commandName],
			permissions: currentCommandPerms,
		});

		// Whitelist the master user / bot owner for every command:
		currentCommandPerms.push({
			type: 2, // User
			id: masterUserId,
			permission: true,
		});

		// If a command is master-user-only, skip including role-based permission
		// overwrites:
		if (currentCommandMinPriv === privilegeLevels.MASTER_USER_ONLY) {
			continue;
		}

		// Whitelist the minimum-privileged role, and every more privileged role
		// (lower priority):
		const minPrivilegePriority = currentCommandMinPriv.priority;
		for (let i = minPrivilegePriority; i >= 0; --i) {
			// NOTE: If privilegedRolesForThisGuild is undefined (privileged roles
			// haven't been configured in this guild yet) this will be assigned
			// undefined via the nullish coalescing operator `.?[]`
			// and be handled accordingly:
			const privilegedRoleId = privilegedRolesForThisGuild?.[
				privilegeLevels.byOrder[i].name
			];
			// If the current guild doesn't have a role assigned to a given
			// privilege level (e.g. they have a mod role but no admin or owner
			// role), then skip that privilege level:
			if (privilegedRoleId === undefined) {
				continue;
			}
			currentCommandPerms.push({
				type: 1, // Role
				id: privilegedRoleId,
				permission: true,
			});
		}
	}
	return await rest.put(
		Routes.guildApplicationCommandsPermissions(clientId, guildId),
		{ body: fullPermissions },
	);
}