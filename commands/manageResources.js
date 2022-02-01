// The #resources messages are made up of sections (bold underlined) and
// subsections (just bold). We can manage this using a keyv store and make it
// easily configurable, then have a message to easily update the post.
// - manage-resources
//   - subcommand-group resource (add/remove/sort individual resource from a specified subsection. Each resource gets a link and text. Use text for remove choices.
//   - subcommand-group subsection (add/remove/sort subsections from specified sections). Each subsection gets a name.
//   - subcommand-group section (add/remove/sort sections)
//   - subcommand post (to specified channel)
const Keyv = require('keyv');
const { SlashCommandBuilder } = require('@discordjs/builders');
const privilegeLevels = require('../privilegeLevels');

// Load configuration database. This stores the resource data for
// each guild in which the bot is a member:
const guildResourcesDB = new Keyv(
	'sqlite://database.sqlite',
	{ namespace: 'guildResources' }
);
guildResourcesDB.on('error', err => console.log(
	'Connection Error when searching for guildResourcesDB',
	err
));

module.exports = {
	data: (new SlashCommandBuilder()
		.setName('manage-resources')
		.setDescription('Add, remove, and organize resources and links, which can then be easily posted to a resources channel')
		.addStringOption(option => option
			.setName('title')
			.setDescription('What string to search page titles for')
			.setRequired(true)
		)
		.addSubcommand(subcommand => subcommand
			.setName('post')
			.setDescription('Post this server\'s resources as an embed to the target channel.')
			.addChannelOption(option => option
				.setName('target')
				.setDescription('The channel to post the resources to.')
				.setRequired(true)
			)
		)
		.setDefaultPermission(false)
	),
	minimumPrivilege: privilegeLevels.byName.MOD,
	async execute(interaction) {
		interaction.reply('Sorry it doesn\'t work yet :(');
	},
};