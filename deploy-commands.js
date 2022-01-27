const fs = require('node:fs');
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');
const { clientId, guildId, token, masterUserId } = require('./config.json');

const privilegeLevels = require('./privilegeLevels');
const Keyv = require('keyv');

// Load configuration database. This will be used to find which color roles
// the current server has:
const privilegedRolesDB = new Keyv('sqlite://database.sqlite', { namespace: 'privilegedRoles' });
privilegedRolesDB.on('error', err => console.log('Connection Error when searching for privilegedRolesDB', err));

// An array of SlashCommandBuilder objects for every command:
const commandData = [];

// An object mapping from command names to those command's minimumPrivileges
// properties, including only commands which have usablyByDefault set to false:
const commandsMinPrivileges = Object.create(null);

const commandFileNames = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));

// For every js file in the commands folder, read its .data property. If it's
// a command with setDefaultPermission(false), then also read its required
// privileges:
for (const file of commandFileNames) {
	const command = require(`./commands/${file}`);
	commandData.push(command.data.toJSON());

	const usableByDefault = command.data.defaultPermission ?? true;
	const minimumPrivilege = command.minimumPrivilege;
	if (usableByDefault) {
		if (minimumPrivilege !== undefined) {
			throw new Error(`Command with name "${command.data.name}" can't have setDefaultPermission(true) and a minimum privilege! Try using setDefaultPermission(false) instead if you want this command to only be available to users with the required role(s).`);
		}
		continue;
	}
	// NOTE: minimumPrivileges may be undefined (absent) even if
	// setDefaultPermission(false) is used. This just means the command will be
	// made so that only the master-user / bot-owner can use it.
	commandsMinPrivileges[command.data.name] = minimumPrivilege;
}

const rest = new REST({ version: '9' }).setToken(token);

(async () => {
	try {
		console.log('Registering application commands...');
		const response = await rest.put(
			Routes.applicationGuildCommands(clientId, guildId),
			{ body: commandData }
		);
		console.log('Successfully registered application commands.');

		// COMMAND PERMISSION OVERWRITES:
		// In the SlashCommandBuilder (.data property) for a command,
		// setDefaultPermission(false) can be used to make a command unusable
		// and visually grayed-out for all users. In order to make the command
		// usable for specific users, we can then use command permission overwrites
		// to whitelist specific users and roles based on id. For this bot,
		// permissions are managed through a generic privilege system.
		//
		// privilegeLevels.js defines a series of generic privilege-levels.
		// These can be referenced in the .minimumPrivilege property in command .js
		// files. Then, in each server the bot operates in, the manage-privileges
		// command is used to assign each privilege level a role. For example,
		// the "MOD" priority level is assigned to the "borks" role in the
		// Okami speedrunning discord. These assignments are stored via keyv in the
		// privilegedRoles namespace of database.sqlite.

		// If there are no commands which have setDefaultPermission(false), don't
		// bother registering command permission overwrites:
		if (Object.keys(commandsMinPrivileges).length === 0) {
			return;
		}

		console.log('Applying application command permission overwrites...');

		// We don't know the id's of each command until we register them, so
		// retrieve the id's from the response and make a map:
		const commandNameToId = new Map();
		for (const command of response) {
			commandNameToId.set(command.name, command.id);
		}

		// For each command
		const fullPermissions = [];
		// May be undefined if privileged roles haven't been configured for this guild yet:
		const privilegedRolesForThisGuild = await privilegedRolesDB.get(guildId);

		for (const commandName in commandsMinPrivileges) {
			const currentCommandMinPriv = commandsMinPrivileges[commandName];
			const currentCommandPerms = [];

			// Push the permissions object for this command pre-emptively, then fill
			// in the permissions array afterwards via reference:
			fullPermissions.push({
				id: commandNameToId.get(commandName),
				permissions: currentCommandPerms,
			});

			// Whitelist the master user / bot owner for every command:
			currentCommandPerms.push({
				type: 2, // User
				id: masterUserId,
				permission: true,
			});

			// If a command has no minimumPrivileges, it is master-user-only, so skip
			// including role-based permission overwrites:
			if (currentCommandMinPriv === undefined) {
				continue;
			}

			// Whitelist the minimum-privileged role, and every more privileged role (lower priority):
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
		await rest.put(
			Routes.guildApplicationCommandsPermissions(clientId, guildId),
			{ body: fullPermissions },
		);

		console.log('Successfully applied permission overwrites.');
	}
	catch (error) {
		console.error(error);
	}
})();