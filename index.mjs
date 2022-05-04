import { Client, Collection, Intents } from 'discord.js';

import { importDir } from './util/importDir.mjs';

import { pkgRelPath } from './util/pkgRelPath.mjs';
import { importJSON } from './util/importJSON.mjs';
const { token } = await importJSON(pkgRelPath('./config.json'));

const client = new Client({
	intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES],
	// To hopefully reduce AbortError: The user aborted a request:
	restRequestTimeout: 60_000,
	retryLimit: 5,
});

// Import each command module and save it to a collection
client.commands = new Collection();
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
const RUN_ON_STARTUP = false;
let index = 0;
for (const routine of routines) {
	if (routine.enabled !== undefined && !routine.enabled) {
		continue;
	}
	const loopTimeout = async () => {
		console.log(`Running routine "${routine.name}" at ${Date()}`);
		try {
			await routine.execute(client);
		}
		catch (RoutineError) {
			// If a routine has an error, all we need to do to temporarily disable it
			// is to return without calling setTimeout again:
			console.error(`Routine "${routine.name}" failed at ${Date()} with the following error, and was disabled. Restart index.mjs to run this routine again:`, RoutineError);
			return;
		}
		console.log(`Routine "${routine.name}" completed at ${Date()}.`);
		timeoutIds[index] = setTimeout(loopTimeout, routine.interval_ms);
	};
	if (RUN_ON_STARTUP) {
		loopTimeout();
	}
	else {
		timeoutIds[index] = setTimeout(loopTimeout, routine.interval_ms);
	}
	++index;
}