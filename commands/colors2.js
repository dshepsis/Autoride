const { SlashCommandBuilder } = require('@discordjs/builders');

const VALID_ROLES_IDS = [
	'932359945070989353',
	'932360425050345473',
	'932360281747779615',
];
const VALID_ROLES_IDS_SET = new Set(VALID_ROLES_IDS);

module.exports = {
	data: new SlashCommandBuilder()
		.setName('colors2')
		.setDescription('Set the color of your username.')
		.addRoleOption(option => option
			.setName('color')
			.setDescription('The name of the color-role you want.')
			.setRequired(true)
		),
	async execute(interaction) {
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
		interaction.reply({ content, ephemeral: true });
	},
};