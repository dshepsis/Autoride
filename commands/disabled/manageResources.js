// The #resources messages are made up of sections (bold underlined) and
// subsections (just bold). We can manage this using a keyv store and make it
// easily configurable, then have a message to easily update the post.
// - manage-resources
//   - subcommand-group section (add/remove/sort sections)
//   - subcommand-group subsection (add/remove/sort subsections from specified sections). Each subsection gets a name.
//   - subcommand-group resource (add/remove/sort individual resource from a specified subsection. Each resource gets a link and text. Use text for remove choices.
//   - subcommand post (to specified channel)
const Keyv = require('keyv');

const { SlashCommandBuilder, codeBlock } = require('@discordjs/builders');
// const { MessageEmbed } = require('discord.js');
const { ChannelType } = require('discord-api-types/v9');

const privilegeLevels = require('../../privilegeLevels');
const { fetchStatusCode } = require('../../util/fetchStatusCode');
const commandConfirmation = require('../command-util/awaitCommandConfirmation');
const commandReply = require('../command-util/awaitCommandReply');

// Load configuration database. This stores the resource data for
// each guild in which the bot is a member:
const guildResourcesDB = new Keyv(
	'sqlite://database.sqlite',
	{ namespace: 'guildResources' }
);
guildResourcesDB.on('error', err => console.log(
	'Connection Error when searching for guildResourcesDB',
	err
));

// Will need to be done via autocomplete???
// Can't use this straight-up because the data property is evaluated synchronously
// and we can't use top-level await without changing to jsm ig ?
// function getSectionsAsChoices(resourcesObj) {
// 	return resourcesObj.sectionOrder.map(name => [name, name]);
// }

// Will need to be done via autocomplete???
// function getSubsectionsAsChoices(resourcesObj) {
// 	return resourcesObj.sectionOrder.map(name => [name, name]);
// }

// Returns an array of objects containing information for every resource which,
// when an HTTPS request was made against its link property, an HTTP response
// code other than 200 "OK" was received:
async function getResourceHTTPError(resourcesObj) {
	const allResources = [];
	const promises = [];
	const sections = resourcesObj.sections;
	for (const sectionName of resourcesObj.sectionOrder) {
		const section = sections[sectionName];
		const subsections = section.subsections;
		for (const subsectionName of section.subsectionOrder) {
			const subsection = subsections[subsectionName];
			const resources = subsection.resources;
			for (const resourceName of subsection.resourceOrder) {
				const resource = resources[resourceName];
				promises.push(fetchStatusCode(resource.link));
				allResources.push({ section, subsection, ...resource });
			}
		}
	}
	const statusCodes = await Promise.all(promises);
	const errors = [];
	// Filter out all of the HTTP 200 OK responses:
	for (let i = 0, len = statusCodes.length; i < len; ++i) {
		const errorCode = statusCodes[i];
		if (errorCode === '200') {
			continue;
		}
		errors.push({ errorCode, ...allResources[i] });
	}
	return errors;
}

const VALID = Symbol('Given object is a valid resources object.');
const NO_SECTIONS = Symbol('Given object must have a \'sections\' property.');
const NO_SECTION_ORDER = Symbol('Given object must have a \'sectionOrder\' property.');
const SECTION_ORDER_SECTION_NOT_FOUND = Symbol('All of the section names given in the sectionOrder property must be property names of the sections object.');
const NO_SUBSECTIONS = Symbol('Given section must have a \'subsections\' property.');
const NO_SUBSECTION_ORDER = Symbol('Given section must have a \'subsectionOrder\' property.');
const SUBSECTION_ORDER_SUBSECTION_NOT_FOUND = Symbol('All of the subsection names given in the subsectionOrder property must be property names of the subsections object.');
const NO_RESOURCES = Symbol('Given subsection must have a \'resources\' property.');
const NO_RESOURCE_ORDER = Symbol('Given subsection must have a \'resourceOrder\' property.');
const RESOURCE_ORDER_RESOURCE_NOT_FOUND = Symbol('All of the resource names given in the resourceOrder property must be property names of the resources object.');
const NO_TEXT = Symbol('Given resource must have a \'text\' property.');
const NO_LINK = Symbol('Given resource must have a \'link\' property.');
// Returns an object containing an issueType property, the value of which is one
// of the above symbols based on whether the given object is of a valid form
// for a resources object, and if not, how so. May also inclued a context
// property, which gives string information on where in the object the failure
// occurred.
function validateResourcesObj(resourcesObj) {
	if (!('sections' in resourcesObj)) {
		return {
			issueType: NO_SECTIONS,
			context: 'Base',
			issueStr: 'Given object must have a \'sections\' property.',
		};
	}
	if (!('sectionOrder' in resourcesObj)) {
		return {
			issueType: NO_SECTION_ORDER,
			context: 'Base',
			issueStr: 'Given object must have a \'sectionOrder\' property.',
		};
	}
	const sections = resourcesObj.sections;
	for (const sectionName of resourcesObj.sectionOrder) {
		if (!(sectionName in sections)) {
			return {
				issueType: SECTION_ORDER_SECTION_NOT_FOUND,
				context: `Section "${sectionName}"`,
				issueStr: `The section "${sectionName}" was found in the sectionOrder array and so must be a property of the sections object, but wasn't found.`,
			};
		}
		const section = sections[sectionName];
		if (!('subsections' in section)) {
			return {
				issueType: NO_SUBSECTIONS,
				context: `Section "${sectionName}"`,
				issueStr: `The section "${sectionName}" must have a 'subsections' property.`,
			};
		}
		if (!('subsectionOrder' in section)) {
			return {
				issueType: NO_SUBSECTION_ORDER,
				context: `Section "${sectionName}"`,
				issueStr: `The section "${sectionName}" must have a 'subsectionOrder' property.`,
			};
		}
		const subsections = section.subsections;
		for (const subsectionName of section.subsectionOrder) {
			if (!(subsectionName in subsections)) {
				return {
					issueType: SUBSECTION_ORDER_SUBSECTION_NOT_FOUND,
					context: `Section "${sectionName}" > Subsection "${subsectionName}"`,
					issueStr: `The subsection "${subsectionName}" was found in the subsectionOrder array of the section "${sectionName}" and so must be a property of the subsections object, but wasn't found.`,
				};
			}
			const subsection = subsections[subsectionName];
			if (!('resources' in subsection)) {
				return {
					issueType: NO_RESOURCES,
					context: `Section "${sectionName}" > Subsection "${subsectionName}"`,
					issueStr: `In section "${sectionName}", the subsection "${subsectionName}" must have a 'resources' property.`,
				};
			}
			if (!('resourceOrder' in subsection)) {
				return {
					issueType: NO_RESOURCE_ORDER,
					context: sectionName,
					issueStr: `In section "${sectionName}", the subsection "${subsectionName}" must have a 'resourceOrder' property.`,
				};
			}
			const resources = subsection.resources;
			for (const resourceName of subsection.resourceOrder) {
				if (!(resourceName in resources)) {
					return {
						issueType: RESOURCE_ORDER_RESOURCE_NOT_FOUND,
						context: `Section "${sectionName}" > Subsection "${subsectionName}" > Resource "${resourceName}"`,
						issueStr: `In section "${sectionName}", subsection "${subsectionName}", the resource "${resourceName}" was found in the resourceOrder array and so must be a property of the resources object, but wasn't found.`,
					};
				}
				const resource = resources[resourceName];
				if (!('text' in resource)) {
					return {
						issueType: NO_TEXT,
						context: `Section "${sectionName}" > Subsection "${subsectionName}" > Resource "${resourceName}"`,
						issueStr: `In section "${sectionName}", subsection "${subsectionName}", the resource "${resourceName}" must have a 'text' property.`,
					};
				}
				if (!('link' in resource)) {
					return {
						issueType: NO_LINK,
						context: `Section "${sectionName}" > Subsection "${subsectionName}" > Resource "${resourceName}"`,
						issueStr: `In section "${sectionName}", subsection "${subsectionName}", the resource "${resourceName}" must have a 'link' property.`,
					};
				}
			}
		}
	}
	return {
		issueType: VALID,
		issueStr: 'No issues were found. The given object is a structurally valid resources object.',
	};
}

module.exports = {
	data: (new SlashCommandBuilder()
		.setName('manage-resources')
		.setDescription('Add, remove, and organize resources/links, which can then be posted to a resources channel')
		.addSubcommandGroup(subcommandGroup => subcommandGroup
			.setName('all')
			.setDescription('A group of commands for manipulating the full resource data for this server')
			.addSubcommand(subcommand => subcommand
				.setName('get-json')
				.setDescription('View the current resources for this server as formatted JSON')
			)
			.addSubcommand(subcommand => subcommand
				.setName('set-json')
				.setDescription('Overwrite this server\'s resources with JSON (multi-step).')
			)
		)
		.addSubcommandGroup(subcommandGroup => subcommandGroup
			.setName('section')
			.setDescription('A group of commands for manipulating the resource sections')
			.addSubcommand(subcommand => subcommand
				.setName('add')
				.setDescription('Add a resource section to the end')
				.addStringOption(option => option
					.setName('name')
					.setDescription('The name of the section to add')
					.setRequired(true)
				)
			)
			.addSubcommand(subcommand => subcommand
				.setName('remove') // Maybe this subcommand should require a confirmation step...
				.setDescription('Remove a resource section and all associated subsections and resources')
				.addStringOption(option => option
					.setName('name')
					.setDescription('The name of the resource section to remove')
					.setRequired(true)
				)
			)
			.addSubcommand(subcommand => subcommand
				.setName('list')
				.setDescription('List out the resource sections in order')
			)
			.addSubcommand(subcommand => subcommand
				.setName('set-order')
				.setDescription('Change the order of resource sections')
				.addStringOption(option => option
					.setName('list')
					.setDescription('The list of section names, each surrounded by double quotes ("), separated by commas (,), in the desired order')
					.setRequired(true)
				)
			)
			.addSubcommand(subcommand => subcommand
				.setName('set-name')
				.setDescription('Change the name of a single resource section')
				.addStringOption(option => option
					.setName('current-name')
					.setDescription('The current name of the section you\'d like to edit')
					.setRequired(true)
				)
				.addStringOption(option => option
					.setName('desired-name')
					.setDescription('The name you would like the the section to have')
					.setRequired(true)
				)
			)
		)
		.addSubcommandGroup(subcommandGroup => subcommandGroup
			.setName('subsection')
			.setDescription('A group of commands for manipulating the resource subsections')
			.addSubcommand(subcommand => subcommand
				.setName('add')
				.setDescription('Add a resource subsection to the end of a section')
				.addStringOption(option => option
					.setName('section')
					.setDescription('The name of the section to add a subsection to')
					.setRequired(true)
				)
				.addStringOption(option => option
					.setName('name')
					.setDescription('The name of the subsection to add')
					.setRequired(true)
				)
			)
			.addSubcommand(subcommand => subcommand
				.setName('remove')
				.setDescription('Remove a resource subsection and all associated resources')
				.addStringOption(option => option
					.setName('section')
					.setDescription('The name of the section to remove a subsection from')
					.setRequired(true)
				)
				.addStringOption(option => option
					.setName('name')
					.setDescription('The name of the subsection to remove')
					.setRequired(true)
				)
			)
			.addSubcommand(subcommand => subcommand
				.setName('list')
				.setDescription('List out the given section\'s subsections in order')
				.addStringOption(option => option
					.setName('section')
					.setDescription('The name of the section to list the subsections of')
					.setRequired(true)
				)
			)
			.addSubcommand(subcommand => subcommand
				.setName('set-order')
				.setDescription('Change the order of resource subsections')
				.addStringOption(option => option
					.setName('section')
					.setDescription('The name of the section to rearrange the subsections of')
					.setRequired(true)
				)
				.addStringOption(option => option
					.setName('list')
					.setDescription('The list of subsection names, each surrounded by double quotes ("), separated by commas (,), in the desired order')
					.setRequired(true)
				)
			)
			.addSubcommand(subcommand => subcommand
				.setName('set-name')
				.setDescription('Change the name of a single resource subsection')
				.addStringOption(option => option
					.setName('section')
					.setDescription('The name of the section to find the subsection in')
					.setRequired(true)
				)
				.addStringOption(option => option
					.setName('current-name')
					.setDescription('The current name of the subsection you\'d like to edit')
					.setRequired(true)
				)
				.addStringOption(option => option
					.setName('desired-name')
					.setDescription('The name you would like the given subsection to have')
					.setRequired(true)
				)
			)
		)
		.addSubcommandGroup(subcommandGroup => subcommandGroup
			.setName('resource')
			.setDescription('A group of commands for manipulating individual resources')
			.addSubcommand(subcommand => subcommand
				.setName('add')
				.setDescription('Add a resource to the end of a subsection')
				.addStringOption(option => option
					.setName('section')
					.setDescription('The name of the section to add a resource to')
					.setRequired(true)
				)
				.addStringOption(option => option
					.setName('subsection')
					.setDescription('The name of the subsection to add a resource to')
					.setRequired(true)
				)
				.addStringOption(option => option
					.setName('text')
					.setDescription('The text description of the resource to add')
					.setRequired(true)
				)
				.addStringOption(option => option
					.setName('link')
					.setDescription('The URL to which the resource should link')
					.setRequired(true)
				)
			)
			.addSubcommand(subcommand => subcommand
				.setName('remove')
				.setDescription('Remove a resource from the given subsection')
				.addStringOption(option => option
					.setName('section')
					.setDescription('The name of the section to remove a resource from')
					.setRequired(true)
				)
				.addStringOption(option => option
					.setName('subsection')
					.setDescription('The name of the subsection to remove a resource from')
					.setRequired(true)
				)
				.addStringOption(option => option
					.setName('text')
					.setDescription('The text description of the resource to remove')
					.setRequired(true)
				)
			)
			.addSubcommand(subcommand => subcommand
				.setName('list')
				.setDescription('List out the given subsection\'s resources in order')
				.addStringOption(option => option
					.setName('section')
					.setDescription('The name of the section to list the resources of')
					.setRequired(true)
				)
				.addStringOption(option => option
					.setName('subsection')
					.setDescription('The name of the subsection to list the resources of')
					.setRequired(true)
				)
			)
			.addSubcommand(subcommand => subcommand
				.setName('set-order')
				.setDescription('Change the order of resources within a subsection')
				.addStringOption(option => option
					.setName('section')
					.setDescription('The name of the section to rearrange the resources of')
					.setRequired(true)
				)
				.addStringOption(option => option
					.setName('subsection')
					.setDescription('The name of the subsection to rearrange the resources of')
					.setRequired(true)
				)
				.addStringOption(option => option
					.setName('list')
					.setDescription('The list of resource text descriptions, each surrounded by double quotes ("), separated by commas (,), in the desired order')
					.setRequired(true)
				)
			)
			.addSubcommand(subcommand => subcommand
				.setName('set-text')
				.setDescription('Change the text description of a single resource')
				.addStringOption(option => option
					.setName('section')
					.setDescription('The name of the section to find the resource in')
					.setRequired(true)
				)
				.addStringOption(option => option
					.setName('subsection')
					.setDescription('The name of the subsection to find the resource in')
					.setRequired(true)
				)
				.addStringOption(option => option
					.setName('current-text')
					.setDescription('The current text description of the resource to edit')
					.setRequired(true)
				)
				.addStringOption(option => option
					.setName('desired-text')
					.setDescription('The text to set the resource\'s description to')
					.setRequired(true)
				)
			)
			.addSubcommand(subcommand => subcommand
				.setName('set-link')
				.setDescription('Change the link of a single resource')
				.addStringOption(option => option
					.setName('section')
					.setDescription('The name of the section to find the resource in')
					.setRequired(true)
				)
				.addStringOption(option => option
					.setName('subsection')
					.setDescription('The name of the subsection to find the resource in')
					.setRequired(true)
				)
				.addStringOption(option => option
					.setName('text')
					.setDescription('The text description of the resource to edit')
					.setRequired(true)
				)
				.addStringOption(option => option
					.setName('desired-link')
					.setDescription('The URL to set the resource\'s link to')
					.setRequired(true)
				)
			)
		)
		.addSubcommand(subcommand => subcommand
			.setName('post')
			.setDescription('Post this server\'s resources as an embed to the target channel.')
			.addChannelOption(option => option
				.setName('channel')
				.setDescription('The channel to post the resources to.')
				.addChannelType(ChannelType.GuildText)
				.setRequired(true)
			)
			.addBooleanOption(option => option
				.setName('as-code-block')
				.setDescription('Post the resources as a code block instead of an embed.')
			)
		)
		.addSubcommand(subcommand => subcommand
			.setName('http-validate')
			.setDescription('Check if any resource URLs have gone 404 (or other http error)')
		)
		.setDefaultPermission(false)
	),
	minimumPrivilege: privilegeLevels.byName.MOD,
	async execute(interaction) {
		// Handle non-group subcommands:
		const subcommandName = interaction.options.getSubcommand();
		const resourcesObj = await guildResourcesDB.get(interaction.guildId);
		// if (subcommandName === 'post') {
		// 	const channel = interaction.options.getChannel('channel');
		// 	const asCodeBlock = interaction.options.getBoolean('as-code-block');
		// 	// const resourceStr = resourcesToString(resourcesObj);
		// 	let postedMsg;
		// 	if (asCodeBlock) {
		// 		const content = codeBlock(resourceStr);
		// 		postedMsg = await channel.send({ content });
		// 	}
		// 	else {
		// 		const embed = new MessageEmbed().setDescription(resourceStr);
		// 		postedMsg = await channel.send({ embeds: [embed] });
		// 	}
		// 	const content = `Reply sent to ${channel}: ${postedMsg.url}`;
		// 	return interaction.reply({ content });
		// }
		if (subcommandName === 'http-validate') {
			const errors = await getResourceHTTPError(resourcesObj);
			if (errors.length === 0) {
				const content = 'Fortunately, all errors seem to have valid URLs.';
				return interaction.reply({ content });
			}
			const errorStr = errors.map(e => `• ${e.section} > ${e.subsection} > ${e.name} links to ${e.link}, which responds with a ${e.errorCode} HTTP error.`).join('\n');
			const content = `The following HTTP errors were detected among this server's resources:\n${errorStr}`;
			return interaction.reply({ content });
		}

		// Handle subcommand groups:
		const groupName = interaction.options.getSubcommandGroup();

		// This subcommand group is used for actions that affect the entire
		// resources object:
		if (groupName === 'all') {
			// This subcommand prints the full JSON of the current guild's resources
			// object:
			if (subcommandName === 'get-json') {
				const content = codeBlock('json', JSON.stringify(resourcesObj, null, 2));
				return interaction.reply({ content });
			}
			// This command is used to overwrite the current guild's resources object
			// with user-submitted JSON. The user is warned before overwriting, and
			// their JSON is validated to ensure it is a valid resources object with
			// no links that respond with HTTP errors:
			if (subcommandName === 'set-json') {
				const {
					responseType: confirmResponseType,
					buttonInteraction,
					botMessage,
				} = await commandConfirmation.awaitCommandConfirmation({
					interaction,
					commandName: 'manage-resources set-json',
					warningContent: `WARNING: If you continue, you will overwrite this server's resources, which are currently:\n${codeBlock('json', JSON.stringify(resourcesObj, null, 2))}`,
					confirmContent: 'Please reply to this message with the JSON for the new server resources, wrapped in a JSON code block.',
					confirmButtonLabel: 'Yes, I want to overwrite this server\'s resources.',
					timeout_ms: 120_000,
				});
				if (confirmResponseType !== commandConfirmation.USER_CONFIRM) {
					// If the user pressed the cancel button or let the confirmation
					// dialog time out, just leave in-place the default replies of
					// awaitCommandConfirmation.
					return buttonInteraction;
				}
				const {
					responseType: replyResponseType,
					userReply,
				} = commandReply.awaitCommandReply({
					interaction,
					commandName: 'manage-resources set-json',
					useMessage: botMessage,
					timeout_ms: 120_000,
					maxLength: 10_000,
				});
				if (replyResponseType !== commandReply.USER_REPLY) {
					// If the user failed to reply to the bot message, just leave in-place
					// the default replies of awaitCommandConfirmation.
					return null;
				}
				let userResources;
				// If the user provided a reply, first validate that it is valid JSON:
				try {
					userResources = JSON.parse(userReply.content);
				}
				catch (e) {
					const content = 'Your response is not valid JSON!';
					return userReply.reply({ content });
				}
				// If the user provided valid JSON, validate that it is a structurally
				// valid resources object:
				const { issueType, issueStr } = validateResourcesObj(userResources);
				if (issueType !== VALID) {
					return userReply.reply({ content: issueStr });
				}
				// If the user provided a valid resources object, check that none of the
				// resource links respond with HTTP error codes:
				const errors = await getResourceHTTPError(userResources);
				if (errors.length === 0) {
					await guildResourcesDB.set(interaction.guildId, userResources);
					const content = 'The JSON you provided passed validation and has now been used to overwrite the previous resources object.';
					return interaction.reply({ content });
				}
				const errorStr = errors.map(e => `• ${e.section} > ${e.subsection} > ${e.name} links to ${e.link}, which responds with a ${e.errorCode} HTTP error.`).join('\n');
				const content = `The JSON you provided was rejected because the following HTTP errors were detected among its resources:\n${errorStr}`;
				return interaction.reply({ content });
			}
		}

		const resourceSections = resourcesObj.sections;
		const resourceSectionOrder = resourcesObj.sectionOrder;
		// This subcommand group is used for actions that affect sections of the
		// resources object
		if (groupName === 'section') {
			// This subcommand adds an empty section with the desired name:
			if (subcommandName === 'add') {
				const newSectionName = interaction.options.getString('name');
				// Check that the desired name isn't already in-use:
				if (newSectionName in resourceSections) {
					const content = `This server's resources already has a section named "${newSectionName}". No change was made. Please choose a different name.`;
					return interaction.reply({ content });
				}
				resourceSectionOrder.push(newSectionName);
				// Make an empty section:
				resourceSections[newSectionName] = {
					subsectionOrder: [],
					subsections: {},
				};
				const content = `Added an empty section named "${newSectionName}" to this server's resources.`;
				return interaction.reply({ content });
			}
			// This subcommand removes the given section:
			if (subcommandName === 'remove') {
				const sectionNameToRemove = interaction.options.getString('name');
				// Check that the desired name is actually in-use:
				if (!(sectionNameToRemove in resourceSections)) {
					const content = `This server's resources doesn't have a section "${sectionNameToRemove}". No change was made. Please choose an existing resource to delete. Use /manage-resources section list to see a list of sections.`;
					return interaction.reply({ content });
				}
				// If the section isn't empty, prompty them for confirmation before
				// deleting it:
				const numSubsections = resourceSections.subsectionOrder.length;
				if (numSubsections > 0) {
					const {
						responseType: confirmResponseType,
						buttonInteraction,
					} = await commandConfirmation.awaitCommandConfirmation({
						interaction,
						commandName: 'manage-resources section delete',
						warningContent: `WARNING: If you continue, you will delete the resource section "${sectionNameToRemove}, which currently contains ${numSubsections} subsections.`,
						confirmContent: `Section "${sectionNameToRemove} has been deleted.`,
						confirmButtonLabel: 'Yes, I want to delete this section.',
						timeout_ms: 60_000,
					});
					if (confirmResponseType !== commandConfirmation.USER_CONFIRM) {
						// If the user pressed the cancel button or let the confirmation
						// dialog time out, just leave in-place the default replies of
						// awaitCommandConfirmation.
						return buttonInteraction;
					}
				}
				// Delete the selected resource:
				delete resourceSections[sectionNameToRemove];
				resourceSectionOrder.splice(resourceSectionOrder.indexOf(sectionNameToRemove));
			}
			// // This subcommand asdf
			// if (subcommandName === 'list') {

			// }
			// // This subcommand asdf
			// if (subcommandName === 'set-order') {

			// }
			// // This subcommand asdf
			// if (subcommandName === 'set-name') {

			// }
		}

		// By default:
		interaction.reply('Sorry it doesn\'t work yet :(');
	},
};