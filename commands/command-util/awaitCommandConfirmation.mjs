import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } from 'discord.js';
import { Replyable } from './Replyable.mjs';

// User response codes:
export const USER_CANCEL = Symbol('User pressed the cancel button');
export const USER_CONFIRM = Symbol('User pressed the confirm button');
export const USER_TIMEOUT = Symbol('User did not interact with the confirm or cancel button within the time limit.');

// Provides a declarative way to give the user of a command a confirm/cancel
// dialogue (using Action Row Buttons) before continuing to execute it:
export async function awaitCommandConfirmation({
	// The interaction object for the command which we're asking the
	// user to confirm.
	interaction,
	// Optional. The message to which to reply with the confirmation message. This
	// is an alternative to replying to the interaction. This is useful if the
	// command has multiple steps and/or you want to give a button prompt after
	// another message (either one of the bot's own messages, or someone else's):
	messageToReplyTo,
	// The name of the command. Only used in message strings.
	commandName,
	// Optional. The content of the initial warning message presented to the
	// user alongside the confirm/cancel buttons:
	warningContent = `Are you sure you want to use this '${commandName}' command?`,
	// Optional. The content of the message presented to the user if they press
	// the confirm button. Set this to null if you don't want a message sent
	// upon pressing the confirm button. This is useful if you want to do an
	// async option and then send a message yourself via the buttonInteraction
	// property of the return object.
	confirmContent = `Executing '${commandName}' command...`,
	// Optional. The content of the message presented to the user if they press
	// the cancel button. Set this to null if you don't want a message sent
	// upon pressing the confrim button.
	cancelContent = `'${commandName}' command cancelled.`,
	// Optional. The text of the confirm button.
	confirmButtonLabel = 'Confirm',
	// Optional. The text of the cancel button.
	cancelButtonLabel = 'Cancel',
	// Optional. The style of the confirm button. Options are:
	// - Primary, a blurple button
	// - Secondary, a grey button
	// - Success, a green button
	// - Danger, a red button (default)
	// - Link, a button that navigates to a URL
	// See
	// https://discord-api-types.dev/api/discord-api-types-v10/enum/ButtonStyle
	buttonStyle = ButtonStyle.Danger,
	// Optional. Whether the confirmation message should be ephemeral (only
	// visible to the command user). true by default. This ONLY applies if
	// messageToReplyTo is not provided
	ephemeral = true,
	// Optional. How many milliseconds to wait for the user to press the confirm
	// or cancel button.
	timeout_ms = 30000,
} = {}) {
	// Send a message warning the user about the action
	const confirmId = 'confirm';
	const cancelId = 'cancel';
	const row = (new ActionRowBuilder()
		// Create confirm button:
		.addComponents(new ButtonBuilder()
			.setCustomId(confirmId)
			.setLabel(confirmButtonLabel)
			.setStyle(buttonStyle),
		)
		// Create cancel button:
		.addComponents(new ButtonBuilder()
			.setCustomId(cancelId)
			.setLabel(cancelButtonLabel)
			.setStyle(ButtonStyle.Secon),
		)
	);
	// Use this utility class to allow for generically replying/editing replies to
	// both interactions and messages
	const replyTo = new Replyable({ message: messageToReplyTo, interaction });
	const warningMessage = await replyTo.reply({
		content: warningContent,
		components: [row],
		ephemeral,
	});

	// Wait for the user to press a button, with the given time limit:
	const filter = warningInteraction => {
		if (warningInteraction.user.id !== interaction.user.id) {
			const content = `These buttons are for <@${interaction.user.id}>, not for you!`;
			warningInteraction.reply({ content, ephemeral: true });
			return false;
		}
		return [confirmId, cancelId].includes(warningInteraction.customId);
	};
	let buttonInteraction;
	try {
		buttonInteraction = await warningMessage.awaitMessageComponent(
			{ filter, componentType: ComponentType.Button, time: timeout_ms }
		);
	}
	catch (error) {
		// This block executes if the user does not press either button within
		// the time limit:
		const content = `This '${commandName}' command timed out after ${
			Math.floor(timeout_ms / 1000)
		} seconds. Please dismiss this message and use the command again if needed.`;
		await replyTo.editReply({ content, components: [] });
		return {
			responseType: USER_TIMEOUT,
			botMessage: warningMessage,
			buttonInteraction,
		};
	}
	// User pressed the confirm button:
	if (buttonInteraction.customId === confirmId) {
		if (confirmContent !== null) {
			await replyTo.editReply({ content: confirmContent, components: [] });
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
			await replyTo.editReply({ content: cancelContent, components: [] });
		}
		return {
			responseType: USER_CANCEL,
			botMessage: warningMessage,
			buttonInteraction,
		};
	}
	// This should never execute
	throw new Error(`Unknown confirmation action for '${commandName}'!`);
}