import { Client, Collection, Intents } from 'discord.js';

import { importDir } from './util/importDir.mjs';

import { pkgRelPath } from './util/pkgRelPath.mjs';

import { importJSON } from './util/importJSON.mjs';
const { token } = await importJSON(pkgRelPath('./config.json'));

const client = new Client({ intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES] });

// Import each command module and save it to a collection
client.commands = new Collection();
// const commands = await importDir(resolve('./commands/'));
const commands = await importDir(pkgRelPath('./commands/'));
for (const command of commands) {
	client.commands.set(command.data.name, command);
}

// Get a list of event modules from the /events directory
const events = await importDir(pkgRelPath('./events/'));
// Attach event listeners declared in each event module
for (const event of events) {
	if (event.once) {
		client.once(event.name, (...args) => event.execute(...args));
	}
	else {
		client.on(event.name, (...args) => event.execute(...args));
	}
}

// The previous steps were just setup, which didn't actually require the client
// to be logged in, but for routines, there's no point in starting them before
// log in, so we await:
await client.login(token);

// Get a list of routine modules from the /routines directory. These are
// basically scripts that run on a set frequency/schedule.
// See /routines/README.md for more info.
const routines = await importDir(pkgRelPath('./routines/'));

// Initialize routines via setTimeout:
const timeoutIds = [];

// Whether to run every routine immediately when the bot logs in, or whether
// to wait for each one's timeout first:
const RUN_ON_STARTUP = true;
let index = 0;
for (const routine of routines) {
	const loopTimeout = async () => {
		console.log(`Running routine "${routine.name}"`);
		await routine.execute(client);
		console.log(`Routine "${routine.name}" completed.`);

		timeoutIds[index] = setTimeout(loopTimeout, routine.interval_ms);
	};
	if (RUN_ON_STARTUP) {
		loopTimeout();
	}
	timeoutIds[index] = setTimeout(loopTimeout, routine.interval_ms);
	++index;
}