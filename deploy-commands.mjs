import { importDir } from './util/importDir.mjs';
import { REST } from '@discordjs/rest';
import { Routes } from 'discord-api-types/v9';
import { importJSON } from './util/importJSON.mjs';

import { pkgRelPath } from './util/pkgRelPath.mjs';

const { clientId, guildIds, developmentGuildId, token } = await importJSON(
	pkgRelPath('./config.json')
);

// An array of SlashCommandBuilder objects for every command:
const commandData = [];
const developmentCommandData = [];

const commands = await importDir(pkgRelPath('./commands/'));

// For every js file in the commands folder, read its .data property:
for (const command of commands) {
	const commandJSON = command.data.toJSON();
	if (!command.inDevelopment) {
		commandData.push(commandJSON);
	}
	developmentCommandData.push(commandJSON);
}


const rest = new REST({ version: '9' }).setToken(token);

async function deployCommandsToGuild(guildId, guildCommandData) {
	console.log(`Registering application commands for guild ${guildId}...`);
	try {
		await rest.put(
			Routes.applicationGuildCommands(clientId, guildId),
			{ body: guildCommandData }
		);
	}
	catch (GuildCommandError) {
		console.error('Failed to deploy commands. Please see this error message:', GuildCommandError);
	}
	console.log('Successfully registered application commands.');
}
await deployCommandsToGuild(developmentGuildId, developmentCommandData);
for (const guildId of guildIds) {
	await deployCommandsToGuild(guildId, commandData);
}