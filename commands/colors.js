const { createRoleSelector } = require('./command-util/roleSelector.js');
const Keyv = require('keyv');

// Load configuration database. This will be used to find which color roles
// the current server has:
const colorRolesDB = new Keyv('sqlite://database.sqlite', { namespace: 'colorRoles' });

module.exports = createRoleSelector({
	name: 'colors',
	description: 'Select your username color.',
	async rolesFromInteraction(interaction) {
		return colorRolesDB.get(interaction.guildId);
	},
});