import { SlashCommandBuilder } from 'discord.js';
import * as manageUrls from '../util/manageMonitoredURLs.mjs';
import { getReportStr } from '../routines/monitorURLsForHTTPErrors.mjs';
import { splitMessageRegex } from '../util/splitMessageRegex.mjs';
import { Replyable } from './command-util/Replyable.mjs';
import { paginatedReply } from './command-util/paginatedReply.mjs';

// Used as choices for the re-enable and disable subcommands
const scopeChoices = [
	'ALL',
	'THIS CHANNEL',
	'MINE',
	'SINGLE URL',
].map(c => ({ name: c, value: c }));

// Used as choices for the remove subcommand
const degreeChoices = [
	'FOR ME IN THIS CHANNEL',
	'FOR ME IN ALL CHANNELS',
	'FOR THIS CHANNEL',
	'REMOVE COMPLETELY',
].map(c => ({ name: c, value: c }));

// For an array of urlObjs, returns a human readable message describing all of
// them. The guild object is required to determine the tags corresponding to
// the userIds in each urlObj
async function urlObjsToHumanReadableStr(urlObjs, guild, {
	verbose = true,
} = {}) {
	// Get all of the user objects for all of the userIds for all of the urlObjs,
	// which are used in building the messages:
	const userIdSet = new Set();
	for (const urlObj of urlObjs) {
		const notifyChannels = urlObj.notifyChannels;
		for (const channelId in notifyChannels) {
			for (const userId of notifyChannels[channelId].userIds) {
				userIdSet.add(userId);
			}
		}
	}
	const memberMap = await guild.members.fetch({ user: Array.from(userIdSet) });

	const infoStrings = [];
	// Turn each url object into a human-readable message:
	for (const urlObj of urlObjs) {
		const escapedURL = '`' + urlObj.url.replaceAll('`', '\\`') + '`';
		const objHeader = (verbose ?
			`- URL ${escapedURL}${urlObj.enabled ? '' : ' (disabled)'}, is being monitored in the following channels:`
			: `- ${escapedURL}${urlObj.enabled ? '' : '(disabled)'}`
		);
		const strLines = [objHeader];
		const notifyChannels = urlObj.notifyChannels;
		for (const channelId in notifyChannels) {
			const notifyObj = notifyChannels[channelId];
			const userTags = notifyObj.userIds.map(userId =>
				memberMap.get(userId).user.tag
			);
			const line = (verbose ?
				` - <#${channelId}>${(notifyObj.info) ? `, with note "${notifyObj.info}"` : ''}, with the following users being notified: ${userTags.join(', ')}`
				: ` - <#${channelId}>${(notifyObj.info) ? `"${notifyObj.info}"` : ''}: ${userTags.join(', ')}`
			);
			strLines.push(line);
		}
		infoStrings.push(strLines.join('\n'));
	}
	const infoSep = verbose ? '\n\n' : '\n';
	return infoStrings.join(infoSep);
}

export const data = (new SlashCommandBuilder()
	.setName('http-monitor')
	.setDescription('Manage the URLs being monitored for errors in this guild')
	.addSubcommand(subcommand => subcommand
		.setName('re-enable')
		.setDescription('Re-enable monitoring for certain URLs for which monitoring has been temporarily disabled')
		.addStringOption(option => option
			.setName('scope')
			.setDescription('Which group of URLs to re-enable')
			.setChoices(...scopeChoices)
			.setRequired(true)
		)
		.addStringOption(option => option
			.setName('url')
			.setDescription('Which URL to re-enable (only checked if scope is SINGLE URL)')
		)
	)
	.addSubcommand(subcommand => subcommand
		.setName('disable')
		.setDescription('Temporarily disable monitoring for certain URLs')
		.addStringOption(option => option
			.setName('scope')
			.setDescription('Which group of URLs to disable')
			.setChoices(...scopeChoices)
			.setRequired(true)
		)
		.addStringOption(option => option
			.setName('url')
			.setDescription('Which URL to disable (only checked if scope is SINGLE URL)')
		)
	)
	.addSubcommand(subcommand => subcommand
		.setName('list')
		.setDescription('List out the URLs being monitored, as well as which users are being notified in which channels')
		.addStringOption(option => option
			.setName('scope')
			.setDescription('Which group of URLs to list')
			.setChoices(...scopeChoices)
			.setRequired(true)
		)
		.addStringOption(option => option
			.setName('url')
			.setDescription('Which URL to list (only checked if scope is SINGLE URL)')
		)
	)
	.addSubcommand(subcommand => subcommand
		.setName('test')
		.setDescription('Immediately test a group of URLs currently being monitored for errors')
		.addStringOption(option => option
			.setName('scope')
			.setDescription('Which group of URLs to test')
			.setChoices(...scopeChoices)
			.setRequired(true)
		)
		.addBooleanOption(option => option
			.setName('errors-only')
			.setDescription('If true, report only URLs which result in an error. Else, include all results.')
		)
		.addStringOption(option => option
			.setName('url')
			.setDescription('Which URL to test (only checked if scope is SINGLE URL)')
		)
	)
	.addSubcommand(subcommand => subcommand
		.setName('add')
		.setDescription('Add a URL to the list to be monitored, or add some information to a URL already being monitored')
		.addStringOption(option => option
			.setName('url')
			.setDescription('The URL to monitor')
			.setRequired(true)
		)
		.addStringOption(option => option
			.setName('info')
			.setDescription('A short description of the URL shown in alerts. Overwrites the previous info if aleady monitored.')
		)
		.addChannelOption(option => option
			.setName('channel')
			.setDescription('Adds a channel to alert in the event of an HTTP error. Uses this channel by default.')
		)
		.addUserOption(option => option
			.setName('user')
			.setDescription('Adds a user to alert in the event of an HTTP error. Uses you by default.')
		)
	)
	.addSubcommand(subcommand => subcommand
		.setName('remove')
		.setDescription('Remove certain alerts for a given URL or stop monitoring it entirely')
		.addStringOption(option => option
			.setName('url')
			.setDescription('The URL to monitor')
			.setRequired(true)
		)
		.addStringOption(option => option
			.setName('degree')
			.setDescription('To what degree should alerts or monitoring be removed')
			.setChoices(...degreeChoices)
			.setRequired(true)
		)
	)
	.setDefaultMemberPermissions(0)
);

/**
 * @param { import("discord.js").CommandInteraction } interaction
 * @returns {Promise<any>}
 */
export async function execute(interaction) {
	await interaction.deferReply();
	const guildId = interaction.guildId;
	const channelId = interaction.channelId;
	const userId = interaction.user.id;
	const subcommandName = interaction.options.getSubcommand();
	const filterFuns = {
		ALL: null,
		['THIS CHANNEL'](urlObj) {
			return (channelId in urlObj.notifyChannels);
		},
		MINE(urlObj) {
			for (const notifyObj of Object.values(urlObj.notifyChannels)) {
				if (notifyObj.userIds.includes(userId)) {
					return true;
				}
			}
			return false;
		},
	};
	if (subcommandName === 're-enable') {
		// A sub-command for re-enabling monitoring for temporarily disabled URLs:
		const scope = interaction.options.getString('scope');
		// If we're re-enabling just one URL:
		if (scope === 'SINGLE URL') {
			const url = interaction.options.getString('url');
			if (url === null) {
				const content = 'You must specify a URL to re-enable monitoring for!';
				return await interaction.editReply({ content });
			}
			const urlObj = await manageUrls.setUrlEnabled({ guildId, url });

			const escapedURL = '`' + url.replaceAll('`', '\\`') + '`';
			const content = ((urlObj === undefined) ?
				`The given url ${escapedURL} was not already being monitored. If you want to enable monitoring for it, use the \`/http-monitor add\` subcommand.`
				: `HTTP error monitoring has been re-enabled for ${escapedURL}.`
			);
			return await interaction.editReply({ content });
		}
		// If we're re-enabling a group of URLs:
		const urlObjFilterFun = filterFuns[scope];
		if (urlObjFilterFun === undefined) {
			const content = `Unrecognized scope "${scope}"!`;
			return await interaction.editReply({ content });
		}
		await manageUrls.setUrlsEnabled({
			guildId,
			urlObjFilterFun,
		});
		const content = `HTTP error monitoring has been re-enabled for URLs under the scope "${scope}"`;
		return await interaction.editReply({ content });
	}
	if (subcommandName === 'disable') {
		// Basically a mirror of the 'enable' subcommand, but with enabled: false
		// and different messages:
		const scope = interaction.options.getString('scope');
		if (scope === 'SINGLE URL') {
			const url = interaction.options.getString('url');
			if (url === null) {
				const content = 'You must specify a URL to disable monitoring for!';
				return await interaction.editReply({ content });
			}
			const urlObj = await manageUrls.setUrlEnabled({
				guildId,
				url,
				enabled: false,
			});
			const escapedURL = '`' + url.replaceAll('`', '\\`') + '`';
			const content = ((urlObj === undefined) ?
				`The given url ${escapedURL} was not already being monitored, and so can't be temporarily disabled.`
				: `HTTP error monitoring has been disabled for ${escapedURL}.`
			);
			return await interaction.editReply({ content });
		}
		// If we're disabling a group of URLs:
		const urlObjFilterFun = filterFuns[scope];
		if (urlObjFilterFun === undefined) {
			const content = `Unrecognized scope "${scope}"!`;
			return await interaction.editReply({ content });
		}
		await manageUrls.setUrlsEnabled({
			guildId,
			urlObjFilterFun,
			enabled: false,
		});
		const content = `HTTP error monitoring has been disabled for URLs under the scope "${scope}"`;
		return await interaction.editReply({ content });
	}
	if (subcommandName === 'list') {
		const scope = interaction.options.getString('scope');
		const guild = interaction.guild;
		if (scope === 'SINGLE URL') {
			const url = interaction.options.getString('url');
			if (url === null) {
				const content = 'You must specify a URL to list information for!';
				return await interaction.editReply({ content });
			}
			const urlObj = await manageUrls.getUrlObjByUrl(guildId, url);
			const escapedURL = '`' + url.replaceAll('`', '\\`') + '`';
			const content = ((urlObj === undefined) ?
				`The given url ${escapedURL} is not being monitored.`
				: await urlObjsToHumanReadableStr([urlObj], guild)
			);
			return await interaction.editReply({ content });
		}
		// If we're listing a group of URLs:
		const urlObjFilterFun = filterFuns[scope];
		if (urlObjFilterFun === undefined) {
			const content = `Unrecognized scope "${scope}"!`;
			return await interaction.editReply({ content });
		}
		const allUrlObjs = await manageUrls.getUrlObjsForGuild(guildId);
		const filteredUrlObjs = (urlObjFilterFun === null ?
			allUrlObjs
			: allUrlObjs.filter(urlObjFilterFun)
		);
		const numObjs = filteredUrlObjs.length;
		const content = ((numObjs === 0) ?
			`No URLs are being currently monitored under the scope "${scope}".`
			: await urlObjsToHumanReadableStr(
				filteredUrlObjs,
				guild,
				{ verbose: false }
			)
		);

		// For broader scopes (especially ALL), the resulting response is likely to
		// exceed the character limit, so we use splitMessageRegex. This is my
		// replacement for discord.js.util#splitMessage while it is affected by
		// https://github.com/discordjs/discord.js/issues/7674
		const contents = splitMessageRegex(content, { regex: /\n+(?!└)/g });
		return await paginatedReply({
			contents,
			replyable: new Replyable({ interaction }),
			editReply: true,
		});
	}
	if (subcommandName === 'test') {
		const scope = interaction.options.getString('scope');
		const errorsOnly = interaction.options.getBoolean('errors-only') ?? true;
		let urlObjsToTest;
		if (scope === 'SINGLE URL') {
			const url = interaction.options.getString('url');
			if (url === null) {
				const content = 'You must specify a URL to test!';
				return await interaction.editReply({ content });
			}
			// The getReportStr function accepts plain URL strings as well as urlObjs.
			// This means we can easily test a URL even if it isn't actually being
			// monitored.
			urlObjsToTest = [url];
		}
		else {
			// If we're testing a group of URLs:
			const urlObjFilterFun = filterFuns[scope];
			if (urlObjFilterFun === undefined) {
				const content = `Unrecognized scope "${scope}"!`;
				return await interaction.editReply({ content });
			}
			const allUrlObjs = await manageUrls.getUrlObjsForGuild(guildId);
			urlObjsToTest = (urlObjFilterFun === null ?
				allUrlObjs
				: allUrlObjs.filter(urlObjFilterFun)
			);
		}
		if (urlObjsToTest.length === 0) {
			const content = `No URLs are being currently monitored under the scope "${scope}".`;
			return await interaction.editReply({ content });
		}
		const content = await getReportStr(urlObjsToTest, { errorsOnly });

		// For broader scopes (especially ALL), the resulting response is likely to
		// exceed the character limit, so we use splitMessageRegex. This is my
		// replacement for discord.js.util#splitMessage while it is affected by
		// https://github.com/discordjs/discord.js/issues/7674
		const contents = splitMessageRegex(content, { regex: /\n+/g });
		return await paginatedReply({
			contents,
			replyable: new Replyable({ interaction }),
			editReply: true, // Because deferReply was used, editReply has to be used
		});
	}

	if (subcommandName === 'add') {
		const url = interaction.options.getString('url');
		const preexistingUrlObj = await manageUrls.getUrlObjByUrl(guildId, url);

		const info = interaction.options.getString('info');
		const channelIdToNotify = (
			interaction.options.getChannel('channel')?.id ?? channelId
		);
		const userIdToNotify = interaction.options.getUser('user')?.id ?? userId;
		const urlObj = {
			url,
			enabled: true,
			notifyChannels: {
				[channelIdToNotify]: {
					userIds: [userIdToNotify],
					info,
				},
			},
		};
		await manageUrls.addUrlObjs(guildId, [urlObj]);
		const escapedURL = '`' + url.replaceAll('`', '\\`') + '`';
		const content = (preexistingUrlObj === undefined ?
			`HTTP error monitoring was added for ${escapedURL}.`
			: `HTTP error monitoring was enabled and updated for ${escapedURL}.`
		);
		return await interaction.editReply({ content });
	}
	if (subcommandName === 'remove') {
		const url = interaction.options.getString('url');
		const escapedURL = '`' + url.replaceAll('`', '\\`') + '`';
		const degree = interaction.options.getString('degree');

		if (degree === 'REMOVE COMPLETELY') {
			const deleted = await manageUrls.deleteUrlObj(guildId, url);
			const content = (deleted ?
				`The URL ${escapedURL} is no longer being monitored.`
				: `The URL ${escapedURL} was already not being monitored. No changes have been made.`
			);
			return await interaction.editReply({ content });
		}

		// If one of the other degrees are used, first request the existing urlObj
		// for the given url, then modify it and pass it back to manageUrlsDB:
		const currentUrlObj = await manageUrls.getUrlObjByUrl(guildId, url);
		const notifyChannels = currentUrlObj.notifyChannels;
		if (currentUrlObj === undefined) {
			const content = `The URL ${escapedURL} was already not being monitored. No changes have been made.`;
			return await interaction.editReply({ content });
		}

		if (degree === 'FOR ME IN THIS CHANNEL') {
			const userIds = notifyChannels[channelId].userIds;
			const index = userIds.indexOf(userId);
			if (index === -1) {
				const content = `You were already not being notified for errors for the URL ${escapedURL} in this channel. No changes have been made.`;
				return await interaction.editReply({ content });
			}
			// If the user to be removed is the only user being notified in the
			// channel, remove the notify object for the channel:
			if (userIds.length === 1) {
				delete notifyChannels[channelId];
			}

			// Otherwise, just remove the given user from the list:
			else {
				userIds.splice(index, 1);
			}
			await manageUrls.overwriteUrlObj(guildId, currentUrlObj);
			const content = `You will no longer be notified of errors for the URL ${escapedURL} in this channel.`;
			return await interaction.editReply({ content });
		}

		if (degree === 'FOR ME IN ALL CHANNELS') {
			let anyChanges = false;
			for (const channelToNotifyId in notifyChannels) {
				const userIds = notifyChannels[channelToNotifyId].userIds;
				const index = userIds.indexOf(userId);
				if (index === -1) {
					continue;
				}
				// If the user to be removed is the only user being notified in the
				// channel, remove the notify object for the channel:
				if (userIds.length === 1) {
					delete notifyChannels[channelToNotifyId];
				}

				// Otherwise, just remove the given user from the list:
				else {
					userIds.splice(index, 1);
				}
				anyChanges = true;
			}
			if (!anyChanges) {
				const content = `You were already not being notified for errors for the URL ${escapedURL} in any channels. No changes have been made.`;
				return await interaction.editReply({ content });
			}
			await manageUrls.overwriteUrlObj(guildId, currentUrlObj);
			const content = `You will no longer be notified of errors for the URL ${escapedURL} in any channel.`;
			return await interaction.editReply({ content });
		}

		if (degree === 'FOR THIS CHANNEL') {
			if (!(channelId in notifyChannels)) {
				const content = `Notifications for errors for the URL ${escapedURL} are already not posted in this channel. No changes have been made.`;
				return await interaction.editReply({ content });
			}
			delete notifyChannels[channelId];
			await manageUrls.overwriteUrlObj(guildId, currentUrlObj);
			const content = `Notifications for errors for the URL ${escapedURL} will no longer be posted in this channel.`;
			return await interaction.editReply({ content });
		}
	}
	const content = `Unrecognized sub-command "${subcommandName}".`;
	return await interaction.editReply({ content });
}