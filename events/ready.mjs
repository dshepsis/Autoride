export const name = 'ready';
export const once = true;
export async function execute(client) {
	console.log(`Client ready as ${client.user.tag}. Setting up commands...`);

	(Array.from(client.commands.values())
		.filter(command => typeof command.onClientReady === 'function')
		.map(command => command.onClientReady(client))
	);

	console.log('Finished setting up commands!');
}