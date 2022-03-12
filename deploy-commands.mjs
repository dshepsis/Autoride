import { resolve } from 'node:path';
import { importDir } from './util/importDir.mjs';
import { REST } from '@discordjs/rest';
import { Routes } from 'discord-api-types/v9';
import { importJSON } from './util/importJSON.mjs';
const { clientId, guildId, token } = await importJSON(resolve('./config.json'));
import { deployPermissions } from './deploy-permissions.mjs';

// import Keyv from 'keyv';

// Used to store some extra command data which isn't sent to Discord, such as
// the minimumPrivilege property for commands with permissions. This data is
// then read in deploy-permissions.cjs.
// const commandMetadataDB = new Keyv('sqlite://database.sqlite', { namespace: 'commandMetadata' });
// commandMetadataDB.on('error', err => console.log('Connection Error when searching for commandMetadataDB', err));

// An array of SlashCommandBuilder objects for every command:
const commandData = [];

const commands = await importDir(resolve('./commands/'));
const commandNameToMinPrivs = Object.create(null);
// For every js file in the commands folder, read its .data property. If it's
// a command with setDefaultPermission(false), then also read its required
// privileges:
for (const command of commands) {
	// const command = require(`./commands/${file}`);
	commandData.push(command.data.toJSON());

	const usableByDefault = command.data.defaultPermission ?? true;
	const minimumPrivilege = command.minimumPrivilege;
	if (usableByDefault) {
		if (minimumPrivilege !== undefined) {
			throw new Error(`Command with name "${command.data.name}" can't have setDefaultPermission(true) and a minimum privilege! Try using setDefaultPermission(false) instead if you want this command to only be available to users with the required role(s).`);
		}
		continue;
	}
	if (minimumPrivilege === undefined) {
		throw new Error(`Command with name "${command.data.name}" must set the .minimumPrivilege property if setDefaultPermission(false) is used. If you want the command to be only usable by the bot owner, try using "minimumPrivilege: privilegeLevels.MASTER_USER_ONLY,".`);
	}
	commandNameToMinPrivs[command.data.name] = minimumPrivilege;
}
// Queue up a task to update the metadata Keyv store:
// const updateMetadataPromise = commandMetadataDB.set(
// 	'minPrivileges',
// 	commandNameToMinPrivs
// );

const rest = new REST({ version: '9' }).setToken(token);

(async () => {
	try {
		console.log('Registering application commands...');
		const response = await rest.put(
			Routes.applicationGuildCommands(clientId, guildId),
			{ body: commandData }
		);
		console.log('Successfully registered application commands.');

		console.log('Applying application command permission overwrites...');
		const commandNameToId = Object.create(null);
		for (const command of response) {
			commandNameToId[command.name] = command.id;
		}
		// Make sure that the Keyv store has been updated:
		// await updateMetadataPromise;
		await deployPermissions({
			guildId,
			commandNameToId,
			rest,
		});
		console.log('Successfully applied permission overwrites.');
	}
	catch (error) {
		console.error(error);
	}
})();