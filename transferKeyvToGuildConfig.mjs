import Keyv from 'keyv';
import * as guildConfig from './util/guildConfig.mjs';

const guildId = '930249527577935893';
const namespaces = {
	colorRoles: 'colorRoles',
	privilegedRoles: 'privilegedRoles',
	guildResources: 'monitoredURLs',
};
for (const sourceNamespace in namespaces) {
	const keyvDB = new Keyv(
		'sqlite://database.sqlite',
		{ namespace: sourceNamespace }
	);
	const sourceObj = await keyvDB.get(guildId);
	await guildConfig.set(guildId, namespaces[sourceNamespace], sourceObj);
}