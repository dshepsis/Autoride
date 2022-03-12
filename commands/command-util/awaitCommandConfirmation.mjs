import { MessageActionRow, MessageButton } from 'discord.js';

// User response codes:
export const USER_CANCEL = Symbol('User pressed the cancel button');
export const USER_CONFIRM = Symbol('User pressed the confirm button');
export const USER_TIMEOUT = Symbol('User did not interact with the confirm or cancel button within the time limit.');

// Provides a declarative way to give the user of a command a confirm/cancel
// dialogue (using Action Row Buttons) before continuing to execute it:
export async function awaitCommandConfirmation({
	// The interaction object for the command which we're asking the user to confirm
	interaction,
	// The name of the command. Only used in message strings.
	commandName,
	// Optional. The content of the initial warning message presented to the
	// user alongside the confirm/cancel buttons:
	warningContent = `Are you sure you want to use this '${commandName}' command?`,
	// Optional. The content of the message presented to the user if they press
	// the confirm button. Set this to null if you don't want a message sent
	// upon pressing the confrim button.
	confirmContent = `Executing '${commandName}' command...`,
	// Optional. The content of the message presented to the user if they press
	// the cancel button. Set this to null if you don't want a message sent
	// upon pressing the confrim button.
	cancelContent = `'${commandName}' command cancelled.`,
	// Optional. The text of the confirm button.
	confirmButtonLabel = 'Confirm',
	// Optional. The style of the confirm button. Options are:
	// - PRIMARY, a blurple button
	// - SECONDARY, a grey button
	// - SUCCESS, a green button
	// - DANGER, a red button (default)
	// - LINK, a button that navigates to a URL
	buttonStyle = 'DANGER',
	// Optional. Whether the confirmation message should be ephemeral (only
	// visible to the command user). true by default.
	ephemeral = true,
	// Optional. How many milliseconds to wait for the user to press the confirm
	// or cancel button.
	timeout_ms = 30000,
} = {}) {
	// Send a message warning the user about the action
	const confirmId = 'confirm';
	const cancelId = 'cancel';
	const row = (new MessageActionRow()
		// Create confirm button:
		.addComponents(new MessageButton()
			.setCustomId(confirmId)
			.setLabel(confirmButtonLabel)
			.setStyle(buttonStyle),
		)
		// Create cancel button:
		.addComponents(new MessageButton()
			.setCustomId(cancelId)
			.setLabel('Cancel')
			.setStyle('SECONDARY'),
		)
	);
	await interaction.reply({
		content: warningContent,
		components: [row],
		ephemeral,
	});
	const warningMessage = await interaction.fetchReply();

	// Wait for the user to press a button, with the given time limit:
	const filter = warningInteraction => (
		[confirmId, cancelId].includes(warningInteraction.customId)
		&& warningInteraction.user.id === interaction.user.id
	);
	let buttonInteraction;
	try {
		buttonInteraction = await warningMessage.awaitMessageComponent(
			{ filter, componentType: 'BUTTON', time: timeout_ms }
		);
	}
	catch (error) {
		// This block executes if the user does not press either button within
		// the time limit:
		const content = `This '${commandName}' command timed out after ${
			Math.floor(timeout_ms / 1000)
		} seconds. Please dismiss this message and use the command again if needed.`;
		await interaction.editReply({ content, components: [], ephemeral: true });
		return {
			responseType: USER_TIMEOUT,
			botMessage: warningMessage,
			buttonInteraction,
		};
	}
	// User pressed the confirm button:
	if (buttonInteraction.customId === confirmId) {
		if (confirmContent !== null) {
			await interaction.editReply({
				content: confirmContent,
				components: [],
				ephemeral: true,
			});
		}
		return {
			responseType: USER_CONFIRM,
			botMessage: warningMessage,
			buttonInteraction,
		};
	}
	// User pressed the cancel button:
	if (buttonInteraction.customId === cancelId) {
		if (cancelContent !== null) {
			await interaction.editReply({
				content: cancelContent,
				components: [],
				ephemeral: true,
			});
		}
		return {
			responseType: USER_CANCEL,
			botMessage: warningMessage,
			buttonInteraction,
		};
	}
	// This should never execute?
	throw new Error(`Unknown confirmation action for '${commandName}'!`);
}