const { SlashCommandBuilder } = require('@discordjs/builders');
const { fetchJson } = require('./command-util/fetchJson');

const WIKI_API_BASE = 'https://okami.speedruns.wiki/api.php?';
module.exports = {
	data: (new SlashCommandBuilder()
		.setName('wiki')
		.setDescription('Get a link to a page on the Okami Speedrunning Wiki.')
		.addStringOption(option => option
			.setName('title')
			.setDescription('What string to search page titles for')
			.setRequired(true)
		)
	),
	async execute(interaction) {
		const query = interaction.options.getString('title');
		const queryURL = `${WIKI_API_BASE}action=query&list=search&srsearch=${query}&srlimit=1&format=json`;
		const response = (await fetchJson(queryURL)).query.search[0];
		if (response === undefined) {
			const content = `Didn't find any pages with titles matching "${query}".\nTry this wiki search link instead: https://okami.speedruns.wiki/index.php?search=${query}`;
			return interaction.reply({ content });
		}

		let resolvedTitle;
		// If the page has more than 20 words, just assume it's not a redirect.
		// This avoids having to make an extra request to check for sure:
		if (response.wordcount > 20) {
			resolvedTitle = response.title;
		}
		else {
			// Check if the page is a redirect, and automatically resolve it if so:
			const redirectCheckURL = `${WIKI_API_BASE}action=query&pageids=${response.pageid}&redirects&format=json`;
			const redirects = (await fetchJson(redirectCheckURL)).query.redirects;
			resolvedTitle = (redirects === undefined) ? response.title : redirects[0].to;
		}
		const content = `https://okami.speedruns.wiki/${resolvedTitle.replace(/\s/g, '_')}`;
		return interaction.reply({ content });
	},
};