import { createRoleSelector } from './command-util/roleSelector.mjs';
import * as guildConfig from '../util/guildConfig.mjs';

export const {
	data,
	execute,
} = createRoleSelector({
	name: 'colors',
	description: 'Select your username color.',
	async rolesFromInteraction(interaction) {
		return await guildConfig.get(interaction.guildId, 'colorRoles');
	},
	sortByGuildOrder: true,
	pageSize: 10,
});