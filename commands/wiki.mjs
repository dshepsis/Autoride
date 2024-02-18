import { fetchJSON } from './command-util/fetchJSON.mjs';
import { SlashCommandBuilder, escapeMarkdown } from 'discord.js';

import { pkgRelPath } from '../util/pkgRelPath.mjs';
import { importJSON } from '../util/importJSON.mjs';
const { wiki } = await importJSON(pkgRelPath('./config.json'));

export const data = (new SlashCommandBuilder()
	.setName('wiki')
	.setDescription('Get a link to a page on the Okami Speedrunning Wiki.')
	.addStringOption(option => option
		.setName('title')
		.setDescription('What string to search page titles for')
		.setRequired(true)
	)
);

/**
 * @param { import("discord.js").CommandInteraction } interaction
 * @returns {Promise<any>}
 */
export async function execute(interaction) {
	const query = interaction.options.getString('title');
	if (query.length > 150) {
		const content = 'Please use a title parameter shorter than 150 characters.';
		return await interaction.reply({ content });
	}

	// For some reason, left angle bracket < in the query causes an
	// internal_api_error_DBQueryError on the Okami speedrunning wiki, so just
	// remove all of them to be safe:
	const sanitizedQueryComponent = encodeURIComponent(query).replaceAll('<', '');

	// Use the MediaWiki API to search page titles for the best-matching page:
	const queryURL = `${wiki.apiURL}action=query&list=search&srsearch=${sanitizedQueryComponent}&srlimit=1&srprop=wordcount&format=json`;
	let response;
	try {
		response = (await fetchJSON(queryURL)).query.search[0];
	}
	catch (e) {
		console.error('Wiki command error: ', e);
		const content = 'Oops! Looks like the wiki\'s API is down or gave an error. Try checking the wiki directly: https://okami.speedruns.wiki/';
		return await interaction.reply({ content });
	}
	if (response === undefined) {
		// If no matching pages are found, direct the user to the wiki's search page:
		const escapedQuery = escapeMarkdown(query).replaceAll('`', '\\`');
		const content = `Didn't find any pages with titles matching "${escapedQuery}".\nTry this wiki search link instead: https://okami.speedruns.wiki/index.php?search=${encodeURIComponent(query)}`;
		return await interaction.reply({ content });
	}

	let resolvedTitle = response.title;
	// If the page has more than 20 words, just assume it's not a redirect.
	// This avoids having to make an extra request to check for sure:
	if (response.wordcount <= 20) {
		// Check if the page is a redirect, and automatically resolve it if so:
		const redirectCheckURL = `${wiki.apiURL}action=query&pageids=${response.pageid}&redirects&format=json`;
		const redirects = (await fetchJSON(redirectCheckURL)).query.redirects;
		if (redirects !== undefined) {
			resolvedTitle = redirects[0].to;
		}
	}
	// MediaWiki automatically converts spaces in the URL to underscores anyways,
	// so we do that ourselves to make the URL cleaner:
	const pagePath = resolvedTitle.replace(/\s/g, '_');
	const content = wiki.URL + pagePath;
	return await interaction.reply({ content });
}