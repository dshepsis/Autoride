import { SlashCommandBuilder, ChannelType } from 'discord.js';
import * as otdUtils from '../util/otdUtils.mjs';

export const data = (new SlashCommandBuilder()
	.setName('manage-otd')
	.setDescription('Configure automatic "On this day" announcements of notable past events')
	.addSubcommand(subcommand => subcommand
		.setName('set-otd-channel')
		.setDescription('Set which channel "On this day" announcements will be posted to')
		.addChannelOption(option => option
			.setName('otd-channel')
			.setDescription('The channel "On this day" announcements will be posted to')
			.addChannelTypes(ChannelType.GuildAnnouncement, ChannelType.GuildText)
			.setRequired(true)
		)
	)
	.addSubcommand(subcommand => subcommand
		.setName('add')
		.setDescription('Add a new notable event.')
		.addStringOption(option => option
			.setName('date')
			.setDescription('A date string like "25 Jun 2023"')
			.setRequired(true)
		)
		.addStringOption(option => option
			.setName('description')
			.setDescription('A description of the notable event that occurred.')
			.setRequired(true)
		)
	)
	.addSubcommand(subcommand => subcommand
		.setName('list')
		.setDescription('List some or all of the notable events.')
		.addStringOption(option => option
			.setName('scope')
			.setDescription('Which events should be reported? All, or only those on the same day/month/year as the date option?')
			.setRequired(true)
			.setChoices(
				{ name: "All events", value: "all" },
				{ name: "Same year", value: "year" },
				{ name: "Same month", value: "month" },
				{ name: "Same day", value: "day" },
			)
		)
		.addStringOption(option => option
			.setName('date')
			.setDescription('A date string like "25 Jun 2023". Required if scope is not All events.')
		)
	)
	.addSubcommand(subcommand => subcommand
		.setName('remove')
		.setDescription('Remove a notable event. Use the list command with the same day scope to find the index.')
		.addStringOption(option => option
			.setName('date')
			.setDescription('A date string like "25 Jun 2023" for which to remove an event.')
			.setRequired(true)
		)
		.addIntegerOption(option => option
			.setName('index')
			.setDescription('The 0-based index of which event for this date to remove.')
			.setRequired(true)
			.setMinValue(0)
		)
	)
	.addSubcommand(subcommand => subcommand
		.setName('post-announcement')
		.setDescription('Immediately posts the announcement which would be posted on the given date.')
		.addStringOption(option => option
			.setName('date')
			.setDescription('A date string like "25 Jun 2023" for which to give the announcement. If omitted, today is used.')
		)
		.addChannelOption(option => option
			.setName('otd-channel')
			.setDescription('The channel the "On this day" announcement will be posted to. If omitted, this channel is used.')
			.addChannelTypes(ChannelType.GuildAnnouncement, ChannelType.GuildText)
		)
	)
	.setDefaultMemberPermissions(0)
);

/**
 * @param {Date} dateObj A JS date object to validate.
 * @returns {boolean} True if the given date object is a valid date, false
 * otherwise.
 */
function isDateValid(dateObj) {
	return !Number.isNaN(dateObj.valueOf());
}

/**
 * Replies to a Discord interaction indicating that the date param is invalid
 * @param { import("discord.js").CommandInteraction } interaction The Discord
 * interaction to reply to 
 * @param {string} dateStr The value of the date param, which is invalid.
 * @returns { Promise<import("discord.js").InteractionResponse<boolean>> }
 */
async function invalidDateRespond(interaction, dateStr) {
	const content = `The date "${dateStr}" was not parsed as a valid date. Please use a common format like "25 Jun 2023".`;
	return await interaction.reply({ content });
}

/**
 * @param { import("discord.js").CommandInteraction } interaction
 * @returns {Promise<any>}
 */
export async function execute(interaction) {	
	const { guildId, options } = interaction;
	/** @type {string} */
	const subcommandName = options.getSubcommand();

	if (subcommandName === 'set-otd-channel') {
		/** @type{ import("discord.js").BaseGuildTextChannel } */
		const channel = options.getChannel('otd-channel', true);
		await otdUtils.setOTDChannel(guildId, channel.id);
		const content = `Success! On-this-day announcements will now be sent to ${channel}.`;
		return await interaction.reply({ content });
	}

	if (subcommandName === "add") {
		/** @type{string} */
		const dateStr = options.getString('date', true);
		const dateObj = new Date(dateStr);
		if (!isDateValid(dateObj)) {
			return await invalidDateRespond(interaction, dateStr);
		}
		/** @type{string} */
		const descr = options.getString('description', true);
		const index = await otdUtils.addOTDEvent(guildId, dateObj, descr);
		const content = `This event has been added at index ${index} on ${otdUtils.formatFullDate(dateObj)}:\n${descr}`;
		return await interaction.reply({ content });
	}

	if (subcommandName === 'list') {
		let eventFilter = undefined;
		let contentScopeStr = '';
		/** @type{"all"|"year"|"month"|"day"} */
		const scope = options.getString('scope', true);
		if (scope !== 'all') {
			/** @type{string} */
			const dateStr = options.getString('date');
			if (dateStr === null) {
				const content = `The date parameter is required if scope is not "all". You selected the scope "${scope}".`;
				return await interaction.reply({ content });
			}
			const dateObj = new Date(dateStr);
			if (!isDateValid(dateObj)) {
				return await invalidDateRespond(interaction, dateStr);
			}
			eventFilter = { scope, dateObj };
			contentScopeStr = ` ${(scope === 'day') ? "on" : "in"} the same ${scope} as ${otdUtils.formatFullDate(dateObj)}`;
		}
		// If scope was 'all', eventFitler will be undefined, which returns all
		// events.
		const eventObjs = await otdUtils.getOTDEvents(guildId, eventFilter);
		console.log(eventObjs);
		const content = ((eventObjs.length === 0)
			? `There are no events listed${contentScopeStr}.`
			: `All events${contentScopeStr}:${eventObjs.map(
				eventObj => `\n- ${otdUtils.formatFullDate(eventObj.date)} — ${eventObj.event}`
			).join("")}`
		);
		return await interaction.reply({ content });
	}

	if (subcommandName === 'remove') {
		/** @type{string} */
		const dateStr = options.getString('date', true);
		const dateObj = new Date(dateStr);
		if (!isDateValid(dateObj)) {
			return await invalidDateRespond(interaction, dateStr);
		}
		/** @type{number} */
		const index = options.getInteger('index', true);
		const removedResult = await otdUtils.removeOTDEvent(
			guildId, dateObj, index
		);
		let content;
		if (removedResult === otdUtils.NO_EVENTS) {
			content = "There are no notable events recorded in this guild to remove. Try adding some using `/manageOTD add` to add some.";
		}
		else if (removedResult === otdUtils.NOT_PRESENT) {
			content = `There was no notable event found for index ${index} on ${otdUtils.formatFullDate(dateObj)} to remove. Try using \`manageOTD list scope:day\` command to choose the correct index.`;
		}
		else {
			content = `The following event was removed from ${otdUtils.formatFullDate(dateObj)}:\n> ${removedResult}`;
		}
		return await interaction.reply({ content });
	}

	if (subcommandName === 'post-announcement') {
		/** @type{string} */
		const dateStr = options.getString('date');
		let dateObj;
		if (dateStr === null) {
			dateObj = new Date();
		}
		else {
			dateObj = new Date(dateStr);
			if (!isDateValid(dateObj)) {
				return await invalidDateRespond(interaction, dateStr);
			}
		}
		/** @type{ import("discord.js").BaseGuildTextChannel } */
		const channel = (
			options.getChannel('otd-channel')
			?? interaction.channel
		);
		const announcementEmbeds = await otdUtils.makeOTDAnnouncementEmbeds(
			guildId, dateObj
		);
		if (announcementEmbeds === null) {
			const content = `There are no events recorded for ${otdUtils.formatDateNoYear(dateObj)}.`;
			return await interaction.reply({ content });
		}
		
		const announcementMsgs = [];
		for (const embed of announcementEmbeds) {
			announcementMsgs.push(await channel.send({ embeds: [embed] }));
		}
		const content = `Announcement sent to ${channel}: <${announcementMsgs[0].url}>`;
		return await interaction.reply({ content });
	}

	// This should never happen:
	const content = `Unhandled subcommand "${subcommandName}"! Please report this!`;
	return await interaction.reply({ content });
}