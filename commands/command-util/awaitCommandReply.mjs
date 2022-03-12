// User response codes:
export const USER_REPLY = Symbol('User replied to the bot.');
export const USER_TIMEOUT = Symbol('User did not reply within the time limit.');
export const USER_OVER_MAX_LENGTH = Symbol('User\'s reply exceeded the given maximum length.');
export const BOT_MESSAGE_DELETED = Symbol('The bot\'s message was deleted before the timeout.');

// Provides a declarative way to wait to request that a user to reply to the
// the bot, then returns the contents of their reply.
export async function awaitCommandReply({
	// The interaction object for the command which we're asking the user to reply
	interaction,
	// The name of the command. Only used in message strings.
	commandName,
	// Optional. How many milliseconds to wait for the user to press the confirm
	// or cancel button.
	timeout_ms = 60000,
	// Optional. If set to true, allows anyone to reply to the bot, with the first
	// response being collected. false by default.
	allowAnyoneToRespond = false,
	// Optional. The content of the message presented to the user asking them to
	// reply
	requestReplyContent = `${allowAnyoneToRespond ? 'P' : `${interaction.user}, p`}lease reply to this message to execute the '${commandName}' command...`,
	// Optional. A pre-existing message to wait for a reply to, instead of
	// making one using requestReplyContent.
	useMessage,
	// Optional. The maximum number of characters allowed for the user's reply.
	// If it's too long, an error message is presented to the user. +Infinity by
	// default (i.e. no character limit).
	maxLength = Infinity,
	// Optional
	overMaxLengthContent = `Your message exceeded the maximum response length of ${maxLength} characters. Please try this '${commandName}' command again.`,
} = {}) {
	// If a pre-existing message is provided, use that. Otherwise, make one:
	let botMessage = useMessage;
	if (useMessage === undefined) {
		await interaction.reply({ content: requestReplyContent });
		botMessage = await interaction.fetchReply();
	}

	const filter = message => (
		(botMessage.id === message?.reference?.messageId)
		&& (allowAnyoneToRespond || (interaction.user.id === message?.author.id))
	);
	try {
		const collected = await interaction.channel.awaitMessages({
			filter,
			max: 1,
			time: timeout_ms,
			errors: ['time'],
		});
		const userReply = collected.first();
		if (userReply.content.length > maxLength) {
			// If the user replied with an excessively long message:
			await interaction.editReply({ content: overMaxLengthContent });
			return {
				responseType: USER_OVER_MAX_LENGTH,
				botMessage,
			};
		}
		return {
			responseType: USER_REPLY,
			userReply: collected.first(),
			botMessage,
		};
	}
	catch (error) {
		const content = `This '${commandName}' command timed out after ${
			Math.floor(timeout_ms / 1000)
		} seconds. Please dismiss this message and use the command again if needed.`;
		try {
			// This may error if the bot's reply was deleted:
			await interaction.editReply({ content });
			return {
				responseType: USER_TIMEOUT,
				botMessage,
			};
		}
		catch (editError) {
			return { responseType: BOT_MESSAGE_DELETED };
		}
	}
}