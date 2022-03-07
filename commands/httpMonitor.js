// @TODO make it so the re-enable and add subcommands instantly check the
// given url for http errors. Might need to add a helper function to
// monitorURLsForHTTPErrors.

const { SlashCommandBuilder } = require('@discordjs/builders');
const privilegeLevels = require('../privilegeLevels');
const manageUrlsDB = require('../util/manageUrlsDB');

// Used as choices for the re-enable and disable subcommands
const scopeChoices = [
	'ALL',
	'THIS CHANNEL',
	'MINE',
	'SINGLE URL',
].map(c => [c, c]);

// Used as choices for the remove subcommand
const degreeChoices = [
	'FOR ME IN THIS CHANNEL',
	'FOR ME IN ALL CHANNELS',
	'FOR THIS CHANNEL',
	'REMOVE COMPLETELY',
].map(c => [c, c]);

// For an array of urlObjs, returns a human readable message describing all of
// them. The guild object is required to determine the tags corresponding to
// the userIds in each urlObj
async function urlObjsToHumanReadableStr(urlObjs, guild) {
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
		const strLines = [`• URL ${escapedURL}${urlObj.enabled ? '' : ' (disabled)'}, is being monitored in the following channels:`];
		const notifyChannels = urlObj.notifyChannels;
		for (const channelId in notifyChannels) {
			const notifyObj = notifyChannels[channelId];
			const userTags = notifyObj.userIds.map(userId =>
				memberMap.get(userId).user.tag
			);
			strLines.push(`    • <#${channelId}>${('info' in notifyObj) ? `, with note "${notifyObj.info}"` : ''}, with the following users being notified: ${userTags.join(', ')}`);
		}
		infoStrings.push(strLines.join('\n'));
	}
	return infoStrings.join('\n\n');
}

module.exports = {
	data: (new SlashCommandBuilder()
		.setName('http-monitor')
		.setDescription('Manage the URLs being monitored for errors in this guild')
		.addSubcommand(subcommand => subcommand
			.setName('re-enable')
			.setDescription('Re-enable monitoring for certain URLs for which monitoring has been temporarily disabled')
			.addStringOption(option => option
				.setName('scope')
				.setDescription('Which group of URLs to re-enable')
				.setChoices(scopeChoices)
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
				.setChoices(scopeChoices)
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
				.setChoices(scopeChoices)
				.setRequired(true)
			)
			.addStringOption(option => option
				.setName('url')
				.setDescription('Which URL to disable (only checked if scope is SINGLE URL)')
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
				.setChoices(degreeChoices)
				.setRequired(true)
			)
		)
		.setDefaultPermission(false)
	),
	minimumPrivilege: privilegeLevels.byName.MOD,
	async execute(interaction) {
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
					return interaction.reply({ content });
				}
				const urlObj = await manageUrlsDB.setUrlEnabled({ guildId, url });

				const escapedURL = '`' + url.replaceAll('`', '\\`') + '`';
				const content = ((urlObj === undefined) ?
					`The given url ${escapedURL} was not already being monitored. If you want to enable monitoring for it, use the \`/http-monitor add\` subcommand.`
					: `HTTP error monitoring has been re-enabled for ${escapedURL}.`
				);
				return interaction.reply({ content });
			}
			// If we're re-enabling a group of URLs:
			const urlObjFilterFun = filterFuns[scope];
			if (urlObjFilterFun === undefined) {
				const content = `Unrecognized scope "${scope}"!`;
				return interaction.reply({ content });
			}
			await manageUrlsDB.setUrlsEnabled({
				guildId,
				urlObjFilterFun,
			});
			const content = `HTTP error monitoring has been re-enabled for URLs under the scope "${scope}"`;
			return interaction.reply({ content });
		}
		if (subcommandName === 'disable') {
			// Basically a mirror of the 'enable' subcommand, but with enabled: false
			// and different messages:
			const scope = interaction.options.getString('scope');
			if (scope === 'SINGLE URL') {
				const url = interaction.options.getString('url');
				if (url === null) {
					const content = 'You must specify a URL to disable monitoring for!';
					return interaction.reply({ content });
				}
				const urlObj = await manageUrlsDB.setUrlEnabled({
					guildId,
					url,
					enabled: false,
				});
				const escapedURL = '`' + url.replaceAll('`', '\\`') + '`';
				const content = ((urlObj === undefined) ?
					`The given url ${escapedURL} was not already being monitored, and so can't be temporarily disabled.`
					: `HTTP error monitoring has been disabled for ${escapedURL}.`
				);
				return interaction.reply({ content });
			}
			// If we're disabling a group of URLs:
			const urlObjFilterFun = filterFuns[scope];
			if (urlObjFilterFun === undefined) {
				const content = `Unrecognized scope "${scope}"!`;
				return interaction.reply({ content });
			}
			await manageUrlsDB.setUrlsEnabled({
				guildId,
				urlObjFilterFun,
				enabled: false,
			});
			const content = `HTTP error monitoring has been disabled for URLs under the scope "${scope}"`;
			return interaction.reply({ content });
		}
		if (subcommandName === 'list') {
			const scope = interaction.options.getString('scope');
			const guild = interaction.guild;
			if (scope === 'SINGLE URL') {
				const url = interaction.options.getString('url');
				if (url === null) {
					const content = 'You must specify a URL to list information for!';
					return interaction.reply({ content });
				}
				const urlObj = await manageUrlsDB.getUrlObjByUrl(guildId, url);
				const escapedURL = '`' + url.replaceAll('`', '\\`') + '`';
				const content = ((urlObj === undefined) ?
					`The given url ${escapedURL} is not being monitored.`
					: await urlObjsToHumanReadableStr([urlObj], guild)
				);
				return interaction.reply({ content });
			}
			// If we're listing a group of URLs:
			const urlObjFilterFun = filterFuns[scope];
			if (urlObjFilterFun === undefined) {
				const content = `Unrecognized scope "${scope}"!`;
				return interaction.reply({ content });
			}
			const allUrlObjs = await manageUrlsDB.getUrlObjsForGuild(guildId);
			const filteredUrlObjs = (urlObjFilterFun === null ?
				allUrlObjs
				: allUrlObjs.filter(urlObjFilterFun)
			);
			const content = ((filteredUrlObjs.length === 0) ?
				`No URLs are being currently monitored under the scope "${scope}".`
				: await urlObjsToHumanReadableStr(filteredUrlObjs, guild)
			);
			return interaction.reply({ content });
		}
		if (subcommandName === 'add') {
			const url = interaction.options.getString('url');
			const preexistingUrlObj = await manageUrlsDB.getUrlObjByUrl(guildId, url);

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
			await manageUrlsDB.addUrlObj(guildId, urlObj);
			const escapedURL = '`' + url.replaceAll('`', '\\`') + '`';
			const content = (preexistingUrlObj === undefined ?
				`HTTP error monitoring was added for ${escapedURL}.`
				: `HTTP error monitoring was enabled and updated for ${escapedURL}.`
			);
			return interaction.reply({ content });
		}
		if (subcommandName === 'remove') {
			const url = interaction.options.getString('url');
			const escapedURL = '`' + url.replaceAll('`', '\\`') + '`';
			const degree = interaction.options.getString('degree');

			// 'FOR ME IN THIS CHANNEL',
			// 'FOR ME IN ALL CHANNELS',
			// 'FOR THIS CHANNEL',
			// 'REMOVE COMPLETELY',
			if (degree === 'REMOVE COMPLETELY') {
				const deleted = await manageUrlsDB.deleteUrlObj(guildId, url);
				const content = (deleted ?
					`The URL ${escapedURL} is no longer being monitored.`
					: `The URL ${escapedURL} was already not being monitored. No changes have been made.`
				);
				return interaction.reply({ content });
			}

			// If one of the other degrees are used, first request the existing urlObj
			// for the given url, then modify it and pass it back to manageUrlsDB:
			const currentUrlObj = await manageUrlsDB.getUrlObjByUrl(guildId, url);
			const notifyChannels = currentUrlObj.notifyChannels;
			if (currentUrlObj === undefined) {
				const content = `The URL ${escapedURL} was already not being monitored. No changes have been made.`;
				return interaction.reply({ content });
			}

			if (degree === 'FOR ME IN THIS CHANNEL') {
				const userIds = notifyChannels[channelId].userIds;
				const index = userIds.indexOf(userId);
				if (index === -1) {
					const content = `You were already not being notified for errors for the URL ${escapedURL} in this channel. No changes have been made.`;
					return interaction.reply({ content });
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
				await manageUrlsDB.overwriteUrlObj(guildId, currentUrlObj);
				const content = `You will no longer be notified of errors for the URL ${escapedURL} in this channel.`;
				return interaction.reply({ content });
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
					return interaction.reply({ content });
				}
				await manageUrlsDB.overwriteUrlObj(guildId, currentUrlObj);
				const content = `You will no longer be notified of errors for the URL ${escapedURL} in any channel.`;
				return interaction.reply({ content });
			}

			if (degree === 'FOR THIS CHANNEL') {
				if (!(channelId in notifyChannels)) {
					const content = `Notifications for errors for the URL ${escapedURL} are already not posted in this channel. No changes have been made.`;
					return interaction.reply({ content });
				}
				delete notifyChannels[channelId];
				await manageUrlsDB.overwriteUrlObj(guildId, currentUrlObj);
				const content = `Notifications for errors for the URL ${escapedURL} will no longer be posted in this channel.`;
				return interaction.reply({ content });

			}
		}
		const content = `Unrecognized sub-command "${subcommandName}".`;
		return interaction.reply({ content, ephemeral: true });
	},
};