const fs = require('fs');
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');
const { clientId, guildId, token } = require('./config.json');

// For slash command permissions:
const { Client, Collection, Intents } = require('discord.js');

const commands = [];
const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
	const command = require(`./commands/${file}`);
	commands.push(command.data.toJSON());
}

const rest = new REST({ version: '9' }).setToken(token);

(async () => {
	try {
		console.log('Registering application commands...');
		await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commands });
		console.log('Successfully registered application commands.');
	}
	catch (error) {
		console.error(error);
	}

	console.log('Registering command permissions...');
	const client = new Client({ intents: [Intents.FLAGS.GUILDS] });
	const fullPermissions = [
		{
			id: '123456789012345678',
			permissions: [{
				id: '224617799434108928',
				type: 'USER',
				permission: false,
			}],
		},
		{
			id: '876543210987654321',
			permissions: [{
				id: '464464090157416448',
				type: 'ROLE',
				permission: true,
			}],
		},
	];
	await client.guilds.cache.get(clientId)?.commands.permissions.set({ fullPermissions });
})();