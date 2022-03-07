const fs = require('node:fs');
const { Client, Collection, Intents } = require('discord.js');
const { token } = require('./config.json');

const client = new Client({ intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES] });

// Get list of command modules from /commands directory
const commandFiles = (fs
	.readdirSync('./commands')
	.filter(file => file.endsWith('.js'))
);

// Import each command module and save it to a collection
client.commands = new Collection();
for (const file of commandFiles) {
	const command = require(`./commands/${file}`);
	client.commands.set(command.data.name, command);
}

// Get a list of event modules from the /events directory
const eventFiles = (fs
	.readdirSync('./events')
	.filter(file => file.endsWith('.js'))
);

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

(async () => {
	await client.login(token);

	// Get a list of routine modules from the /routines directory. These are
	// basically scripts that run on a set frequency/schedule.
	// See /routines/README.md for more info.
	const routineFiles = (fs
		.readdirSync('./routines')
		.filter(file => file.endsWith('.js'))
	);

	// Initialize routines via setTimeout:
	const timeoutIdsByFilename = Object.create(null);
	const TEST_INSTANT_ROUTINE = true;
	for (const file of routineFiles) {
		const routine = require(`./routines/${file}`);

		const loopTimeout = async () => {
			console.log(`Running routine "${file}"`);
			await routine.execute(client);
			console.log(`Routine "${file}" completed.`);

			timeoutIdsByFilename[file] = setTimeout(loopTimeout, routine.interval_ms);
		};
		if (TEST_INSTANT_ROUTINE) {
			loopTimeout();
		}
		timeoutIdsByFilename[file] = setTimeout(loopTimeout, routine.interval_ms);
	}
})();