const { SlashCommandBuilder } = require('@discordjs/builders');

const VALID_ROLES_IDS = [
	'932359945070989353', // Red
	'932360425050345473', // Green
	'932360281747779615', // Blue
];
const VALID_ROLES_IDS_SET = new Set(VALID_ROLES_IDS);

module.exports = {
	data: new SlashCommandBuilder()
		.setName('colors3')
		.setDescription('Set the color of your username, or see the available colors.')
		.addSubcommand(subcommand => subcommand
			.setName('get')
			.setDescription('Set the color of your username.')
			.addRoleOption(option => option
				.setName('color')
				.setDescription('The name of the color-role you want.')
				.setRequired(true)
			)
		)
		.addSubcommand(subcommand => subcommand
			.setName('list')
			.setDescription('Get a list of color roles.')
		),
	async execute(interaction) {
		const subcommand = interaction.options.getSubcommand();
		if (subcommand === 'list') {
			const content = `These are the valid color roles:\n${VALID_ROLES_IDS.map(id => `<@&${id}>`).join('\n')}`;
			return interaction.reply({ content, ephemeral: true });
		}

		const selectedRole = interaction.options.getRole('color');

		if (!VALID_ROLES_IDS_SET.has(selectedRole.id)) {
			const content = 'You must choose a color role.';
			return interaction.reply({ content, ephemeral: true });
		}

		const userRoles = interaction.member.roles;
		for (const roleIdToRemove of VALID_ROLES_IDS) {
			userRoles.remove(roleIdToRemove);
		}
		userRoles.add(selectedRole);

		const content = `You're ${selectedRole} now!`;
		return interaction.reply({ content, ephemeral: true });
	},
};