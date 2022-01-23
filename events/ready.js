module.exports = {
	name: 'ready',
	once: true,
	async execute(client) {
		console.log(`Logged in as ${client.user.tag}. Setting up commands...`);

		await Promise.all(Array.from(client.commands.values())
			.filter(command => typeof command.onClientReady === 'function')
			.map(command => command.onClientReady(client))
		);

		console.log('Finished setting up commands!');
	},
};