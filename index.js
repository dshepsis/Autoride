const fs = require('fs');
const { Client, Collection, Intents } = require('discord.js');
const { token } = require('./config.json');

const client = new Client({ intents: [Intents.FLAGS.GUILDS] });

// Get list of command modules from /commands directory
const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));

// Import each command module and save it to a collection
client.commands = new Collection();
for (const file of commandFiles) {
	const command = require(`./commands/${file}`);
	client.commands.set(command.data.name, command);
}

// Get a list of event modules from the /events directory
const eventFiles = fs.readdirSync('./events').filter(file => file.endsWith('.js'));

// Attach event listeners declared in each event module
for (const file of eventFiles) {
	const event = require(`./events/${file}`);
	if (event.once) {
		client.once(event.name, (...args) => event.execute(...args));
	}
	else {
		client.on(event.name, (...args) => event.execute(...args));
	}
}

const OLD_EVENTS = false;

if (OLD_EVENTS) {
	client.once('ready', () => {
		console.log('Ready!');
	});

	client.on('interactionCreate', async interaction => {
		if (!interaction.isCommand()) return;

		const command = client.commands.get(interaction.commandName);

		if (!command) return;

		try {
			await command.execute(interaction);
		}
		catch (error) {
			console.error(error);
			return interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
		}
	});
}

client.login(token);
