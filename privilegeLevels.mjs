/**
 * An array of objects describing different privilege levels, in order, with the
 * highest privilege at the top (lowest index):
 */
export const byOrder = Object.freeze([
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
]);

const byName = Object.create(null);
for (let i = 0, len = byOrder.length; i < len; ++i) {
	const priv = byOrder[i];
	priv.priority = i;
	byName[priv.name] = priv;
}
Object.freeze(byName);
export { byName };

/**
 * The privilege level names formatted as choices usable for setChoices() in
 * .addStringOption() in SlashCommandBuilders:
 */
export const asChoices = Object.freeze(byOrder.map(p => ([p.name, p.name])));

/**
 * A special privilege level value used in place of
 * .byName[privilege level name]:
 * e.g. `minimumPrivilege: privilegeLevels.MASTER_USER_ONLY,`
 */
export const MASTER_USER_ONLY = 'Only the master user (bot owner) may use this command.';