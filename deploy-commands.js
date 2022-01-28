const fs = require('node:fs');
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');
const { clientId, guildId, token } = require('./config.json');
const { deployPermissions } = require('./deploy-permissions');

const Keyv = require('keyv');
const commandMetadataDB = new Keyv('sqlite://database.sqlite', { namespace: 'commandMetadata' });
commandMetadataDB.on('error', err => console.log('Connection Error when searching for commandMetadataDB', err));


// An array of SlashCommandBuilder objects for every command:
const commandData = [];

const commandFileNames = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));

// For every js file in the commands folder, read its .data property. If it's
// a command with setDefaultPermission(false), then also read its required
// privileges:
const commandNameToMinPrivs = Object.create(null);
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
	if (minimumPrivilege === undefined) {
		throw new Error(`Command with name "${command.data.name}" must set the .minimumPrivilege property if setDefaultPermission(false) is used. If you want the command to be only usable by the bot owner, try using "minimumPrivilege: privilegeLevels.MASTER_USER_ONLY,".`);
	}
	commandNameToMinPrivs[command.data.name] = minimumPrivilege;
}

const rest = new REST({ version: '9' }).setToken(token);

(async () => {
	await commandMetadataDB.set('minPrivileges', commandNameToMinPrivs);
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