/**
 * A monad for replying to either interactions or messages, and then potentially
 * editing those replies. This is needed because the Interaction.reply and
 * Message.reply methods are actually a little different in options.
 */
export class Replyable {
	#message;
	#interaction;
	#useMessage;
	#sentReply;
	constructor({ message, interaction } = {}) {
		if (message) {
			this.#message = message;
			this.#useMessage = true;
		}
		else if (interaction) {
			this.#interaction = interaction;
			this.#useMessage = false;
		}
		else {
			throw new Error('When constructing a Replyable, you must include a message and/or interaction, but neither was received.');
		}
	}
	async reply(messageOptions) {
		if (this.#useMessage) {
			this.#sentReply = await this.#message.reply(messageOptions);
			return this.#sentReply;
		}
		await this.#interaction.reply(messageOptions);
		return this.#interaction.fetchReply();
	}
	async editReply(messageOptions) {
		if (this.#useMessage) {
			return this.#sentReply.edit(messageOptions);
		}
		return this.#interaction.editReply(messageOptions);
	}
	getUser() {
		if (this.#useMessage) {
			return this.#message.author;
		}
		return this.#interaction.user;
	}
}