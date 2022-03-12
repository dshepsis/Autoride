import { SlashCommandBuilder } from '@discordjs/builders';
import { fetchJSON } from './command-util/fetchJSON.mjs';
import { Util } from 'discord.js';

const WIKI_API_BASE = 'https://okami.speedruns.wiki/api.php?';
export const data = (new SlashCommandBuilder()
	.setName('wiki')
	.setDescription('Get a link to a page on the Okami Speedrunning Wiki.')
	.addStringOption(option => option
		.setName('title')
		.setDescription('What string to search page titles for')
		.setRequired(true)
	)
);
export async function execute(interaction) {
	const query = interaction.options.getString('title');
	if (query.length > 150) {
		const content = 'Please use a title parameter shorter than 150 characters.';
		return interaction.reply({ content });
	}

	// Use the MediaWiki API to search page titles for the best-matching page:
	const queryURL = `${WIKI_API_BASE}action=query&list=search&srsearch=${encodeURIComponent(query)}&srlimit=1&format=json`;
	let response;
	try {
		response = (await fetchJSON(queryURL)).query.search[0];
	}
	catch (e) {
		console.log(e);
		const content = 'Oops! Looks like the wiki\'s API is down! Try checking the wiki directly: https://okami.speedruns.wiki/';
		return interaction.reply({ content });
	}
	if (response === undefined) {
		// If no matching pages are found, direct the user to the wiki's search page:
		// @TODO WARNING: This code may still be affected by this bug: https://github.com/discordjs/discord.js/issues/7373
		const escapedQuery = Util.escapeMarkdown(query).replaceAll('`', '\\`');
		const content = `Didn't find any pages with titles matching "${escapedQuery}".\nTry this wiki search link instead: https://okami.speedruns.wiki/index.php?search=${encodeURIComponent(query)}`;
		return interaction.reply({ content });
	}

	let resolvedTitle = response.title;
	// If the page has more than 20 words, just assume it's not a redirect.
	// This avoids having to make an extra request to check for sure:
	if (response.wordcount <= 20) {
		// Check if the page is a redirect, and automatically resolve it if so:
		const redirectCheckURL = `${WIKI_API_BASE}action=query&pageids=${response.pageid}&redirects&format=json`;
		const redirects = (await fetchJSON(redirectCheckURL)).query.redirects;
		if (redirects !== undefined) {
			resolvedTitle = redirects[0].to;
		}
	}
	// MediaWiki automatically converts spaces in the URL to underscores anyways,
	// so we do that ourselves to make the URL cleaner:
	const pagePath = resolvedTitle.replace(/\s/g, '_');
	const content = `https://okami.speedruns.wiki/${pagePath}`;
	return interaction.reply({ content });
}