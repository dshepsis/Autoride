import { MessageEmbed, MessageActionRow, MessageButton } from 'discord.js';

export async function paginatedReply({
	contents,
	replyable,
	editReply = false,
	ephemeral = false,
} = {}) {
	console.log('Paginated Reply');
	const numPages = contents.length;
	const contentEmbeds = contents.map(
		str => new MessageEmbed().setDescription(str)
	);
	// If there is only one page, do not include the page buttons:
	if (numPages === 1) {
		console.log('only one page');
		if (editReply) {
			// ephemeral only ever applies to the first reply to an interaction. You
			// can't change an ephemeral reply to a non-ephemeral one, or vice-versa.
			return replyable.editReply({ embeds: contentEmbeds });
		}
		return replyable.reply({ embeds: contentEmbeds, ephemeral });
	}
	let currentPage = 0;
	const buttonOrder = [
		{
			id: 'first-page',
			label: '❚◀',
			press() { currentPage = 0; },
		},
		{
			id: 'previous-page',
			label: '◀',
			disabled: true,
			press() { --currentPage; },
		},
		{
			id: 'page-number',
			label: `1 / ${numPages}`,
			disabled: true,
		},
		{
			id: 'next-page',
			label: '▶',
			press() { ++currentPage; },
		},
		{
			id: 'last-page',
			label: '▶❚',
			press() { currentPage = numPages - 1; },
		},
	];
	const buttonData = Object.create(null);
	const buttonComponents = [];
	for (const button of buttonOrder) {
		buttonData[button.id] = button;
		const component = (new MessageButton()
			.setCustomId(button.id)
			.setLabel(button.label)
			.setStyle(button.style ?? 'SECONDARY')
			.setDisabled(button.disabled ?? false)
		);
		button.component = component;
		buttonComponents.push(component);
	}
	const row = new MessageActionRow().addComponents(buttonComponents);
	const getPageResponse = page => {
		buttonData['first-page'].component.setDisabled(page <= 0);
		buttonData['previous-page'].component.setDisabled(page <= 0);
		buttonData['next-page'].component.setDisabled(page >= numPages - 1);
		buttonData['last-page'].component.setDisabled(page >= numPages - 1);
		buttonData['page-number'].component.setLabel(
			`${currentPage + 1} / ${numPages}`
		);
		return {
			embeds: [contentEmbeds[page]],
			components: [row],
			ephemeral,
		};
	};
	const botMessage = await (editReply ?
		replyable.editReply(getPageResponse(currentPage))
		: replyable.reply(getPageResponse(currentPage))
	);
	// make listener for buttons which changes the currentPage var and calls
	// getPageResponse or w/e. This should be ez

	const userId = replyable.getUser().id;
	const collector = botMessage.createMessageComponentCollector({
		idle: 5 * 60_000,
	});
	collector.on('collect', async buttonInteraction => {
		if (buttonInteraction.user.id !== userId) {
			const content = `These buttons are for <@${userId}>, not for you!`;
			return await buttonInteraction.reply({ content, ephemeral: true });
		}
		const buttonId = buttonInteraction.customId;
		buttonData[buttonId].press();
		await buttonInteraction.update(getPageResponse(currentPage));
	});
	collector.on('end', async () => {
		for (const button of buttonOrder) {
			button.component.setDisabled();
		}
		const content = 'This paginated message has timed out. Please re-use the original command to see the other pages again.';
		// If the message was deleted, trying to edit it will throw:
		try {
			return await replyable.editReply({ content, embeds: [], components: [] });
		}
		catch (error) {
			return;
		}
	});
}