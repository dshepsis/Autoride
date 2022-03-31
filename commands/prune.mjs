import { SlashCommandBuilder } from '@discordjs/builders';

import { byName } from '../privilegeLevels.mjs';
import { awaitCommandConfirmation, USER_CONFIRM } from './command-util/awaitCommandConfirmation.mjs';

const MAX_MESSAGES = 100;

export const data = (new SlashCommandBuilder()
	.setName('prune')
	.setDescription(`Bulk delete up to ${MAX_MESSAGES} messages.`)
	.addIntegerOption(option => option
		.setName('amount')
		.setDescription(`Number of messages to delete, between 1 and ${MAX_MESSAGES}.`)
		.setRequired(true)
		.setMinValue(1)
		.setMaxValue(MAX_MESSAGES)
	)
	.setDefaultPermission(false)
);
export const minimumPrivilege = byName.ADMIN;
export async function execute(interaction) {
	const amount = interaction.options.getInteger('amount');

	// Prevent the user from selecting an incorrect number of commands
	if (amount < 1 || amount > MAX_MESSAGES) {
		const content = `You must choose a number of messages to delete between 1 and ${MAX_MESSAGES} (inclusive).`;
		return await interaction.reply({ content, ephemeral: true });
	}

	const {
		responseType,
		buttonInteraction,
	} = await awaitCommandConfirmation({
		interaction,
		commandName: 'prune',
		warningContent: `WARNING: You're about to delete the last ${amount} messages. This CANNOT be undone!`,
		confirmContent: null,
		confirmButtonLabel: `Yes, delete ${amount} messages.`,
	});
	if (responseType !== USER_CONFIRM) {
		// If the user pressed the cancel button or let the confirmation dialog
		// time out, just leave in-place the default replies of
		// awaitCommandConfirmation.
		return;
	}

	// If the user confirmed they want to bulk delete messages:
	let messagesDeleted;
	try {
		messagesDeleted = await interaction.channel.bulkDelete(amount, true);
	}
	catch (error) {
		console.error(error);
		const content = 'There was an error trying to delete messages in this channel!';
		return await buttonInteraction.update(
			{ content, components: [], ephemeral: true }
		);
	}
	const content = `Successfully deleted \`${messagesDeleted.size}\` messages.`;
	return await buttonInteraction.update(
		{ content, components: [], ephemeral: true }
	);
}