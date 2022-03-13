import { createRoleSelector } from './command-util/roleSelector.mjs';
// import Keyv from 'keyv';
import * as guildConfig from '../util/guildConfig.mjs';

// Load configuration database. This will be used to find which color roles
// the current server has:
// const colorRolesDB = new Keyv(
// 	'sqlite://database.sqlite',
// 	{ namespace: 'colorRoles' }
// );

export const {
	data,
	execute,
} = createRoleSelector({
	name: 'colors',
	description: 'Select your username color.',
	async rolesFromInteraction(interaction) {
		// return colorRolesDB.get(interaction.guildId);
		return guildConfig.get(interaction.guildId, 'colorRoles');
	},
	sortByGuildOrder: true,
	pageSize: 10,
});