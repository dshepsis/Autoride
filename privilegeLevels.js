// Highest privilege at the top (lowest index):
const byOrder = [
	{
		name: 'OWNER',
		description: 'A server owner role',
	},
	{
		name: 'ADMIN',
		description: 'A server administrator role',
	},
	{
		name: 'MOD',
		description: 'A server moderator role',
	},
	{
		name: 'VERIFIED',
		description: 'A role for verified users',
	},
];

const byName = Object.create(null);
for (let i = 0, len = byOrder.length; i < len; ++i) {
	const priv = byOrder[i];
	priv.priority = i;
	byName[priv.name] = priv;
}
// Object.freeze(byName); // ??? Is this necessary?

// Format the privilege level names as choices usable for setChoices() in
// setChoices() in .addStringOption() in SlashCommandBuilders:
const asChoices = byOrder.map(p => ([p.name, p.name]));

module.exports = { byOrder, byName, asChoices };